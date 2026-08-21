'use strict';

const path = require('path');
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const { HarnessSupervisor } = require('./harness');
const {
  checkHarnessUpdates,
  applyHarnessUpdate,
  restoreHarnessFromSeed,
  ensureHarnessReadyAsync,
  isUpdateInFlight,
} = require('./update');
const { cleanupHarnessArtifacts } = require('./layout');
const { ensureDesktopPlugins } = require('./ensure-plugin');
const { createCoreBridge } = require('./core-bridge');
const {
  shellUpdateStatus,
  checkShellUpdate,
  downloadAndInstallShellUpdate,
  isShellInstallPending,
} = require('./shell-update');
const {
  resolveNode,
  resolveDshEntry,
  dshHome,
  workspaceDir,
  withLocalBins,
  harnessRoot,
  readVersionJson,
  readShellManifest,
  writableDesktopRoot,
} = require('./paths');

let mainWindow = null;
let harness = null;
let coreBridge = null;
let quitting = false;
const logBuffer = [];

function pushLog(entry) {
  logBuffer.push(entry);
  if (logBuffer.length > 400) logBuffer.splice(0, logBuffer.length - 400);
  mainWindow?.webContents.send('harness:log', entry);
}

function sendStatus(payload) {
  mainWindow?.webContents.send('harness:status', payload);
}

function sendCoreProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('core:progress', payload);
  }
  coreBridge?.broadcastProgress(payload);
  sendStatus({ phase: 'updating', ...payload });
}

function sendUpdateLog(entry) {
  const row = {
    stream: entry.stream || 'system',
    line: String(entry.line || ''),
    at: Date.now(),
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('core:log', row);
  }
  coreBridge?.broadcastLog(row);
  pushLog({ stream: 'update', line: `[${row.stream}] ${row.line}` });
}

async function injectDesktopBridge() {
  if (!coreBridge || !mainWindow || mainWindow.isDestroyed()) return;
  const url = mainWindow.webContents.getURL();
  if (!url.startsWith('http://127.0.0.1:') && !url.startsWith('https://127.0.0.1:')) {
    return;
  }
  try {
    await mainWindow.webContents.executeJavaScript(coreBridge.injectScript(), true);
  } catch (error) {
    pushLog({ stream: 'system', line: `注入桌面桥失败: ${error.message || error}` });
  }
}

function runtimeOptions() {
  const home = dshHome();
  const root = harnessRoot();
  const nodePath = resolveNode();
  const dshEntry = resolveDshEntry();
  const cwd = workspaceDir(home);
  const env = withLocalBins(process.env, root, nodePath);
  return { nodePath, dshEntry, dshHome: home, cwd, env };
}

async function createRuntime() {
  sendStatus({ phase: 'starting', message: '正在检查 Harness 运行时…' });
  await ensureHarnessReadyAsync(
    (p) => {
      sendStatus({ phase: 'starting', message: p.message });
      pushLog({ stream: 'system', line: p.message });
    },
    (entry) => {
      pushLog(entry);
      sendUpdateLog(entry);
    },
  );
  const pluginResult = ensureDesktopPlugins(dshHome());
  if (pluginResult.ok) {
    const changed = (pluginResult.results || []).filter((r) => r.changed);
    for (const r of changed) {
      pushLog({
        stream: 'system',
        line: `已同步桌面插件 ${r.plugin}@${r.version}`,
      });
    }
    if (!changed.length && pluginResult.results?.length) {
      pushLog({
        stream: 'system',
        line: `桌面插件已就绪：${pluginResult.results.map((r) => r.plugin).join(', ')}`,
      });
    }
  } else {
    for (const f of pluginResult.failed || []) {
      pushLog({ stream: 'stderr', line: `桌面插件同步失败: ${f.reason || f.plugin}` });
    }
  }
  const options = runtimeOptions();
  harness = new HarnessSupervisor(options);

  harness.on('log', (entry) => {
    console.log(`[harness:${entry.stream}] ${entry.line}`);
    pushLog(entry);
    sendStatus({ phase: harness.url ? 'ready' : 'starting', url: harness.url, line: entry.line });
  });
  harness.on('ready', ({ url }) => {
    sendStatus({ phase: 'ready', url });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(url);
    }
  });
  harness.on('error', (error) => {
    pushLog({ stream: 'system', line: String(error) });
    sendStatus({ phase: 'error', message: String(error) });
  });
  harness.on('exit', ({ expected }) => {
    if (!expected && mainWindow && !mainWindow.isDestroyed() && !isUpdateInFlight()) {
      loadSplash();
      sendStatus({ phase: 'starting', message: 'harness 正在重启' });
    }
  });

  harness.start();
}

async function restartHarnessFresh() {
  if (!harness) return;
  harness.reconfigure(runtimeOptions());
  loadSplash();
  sendStatus({ phase: 'starting', message: '正在重启 harness' });
  await harness.restart();
}

function loadSplash() {
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'splash.html'));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#111111',
    title: 'DeepSeek Harness',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  loadSplash();
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.webContents.on('did-finish-load', () => {
    void injectDesktopBridge();
  });
  mainWindow.webContents.on('did-navigate', () => {
    void injectDesktopBridge();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1:') || url.startsWith('https://127.0.0.1:')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function aboutMessage() {
  const shellPkg = readShellManifest();
  const harnessVer = readVersionJson(harnessRoot()) || {};
  return [
    `壳版本: ${shellPkg.version}`,
    `Harness (dsh): ${harnessVer.dsh || '未知'}`,
    `sidecar Node: ${harnessVer.node || '未知'}`,
    `来源: ${harnessVer.source || '未知'}`,
    `运行时: ${harnessRoot()}`,
    `数据目录: ${dshHome()}`,
  ].join('\n');
}

async function applyInstallVersion(version) {
  if (isUpdateInFlight()) {
    throw new Error('更新进行中，请稍候');
  }
  sendUpdateLog({ stream: 'system', line: `开始更新 → ${version}` });
  if (mainWindow && !mainWindow.isDestroyed()) {
    loadSplash();
  }
  sendCoreProgress({ message: `正在更新到 ${version}`, stage: 'start' });
  sendUpdateLog({ stream: 'system', line: '停止当前 Harness…' });
  await harness?.stop();
  sendUpdateLog({ stream: 'system', line: 'Harness 已停止' });
  await applyHarnessUpdate(version, {
    onProgress: (p) => sendCoreProgress(p),
    onLog: (entry) => sendUpdateLog(entry),
  });
  sendUpdateLog({ stream: 'system', line: '正在重启 Harness…' });
  await restartHarnessFresh();
  sendUpdateLog({ stream: 'system', line: 'Harness 已重启' });
  const cleaned = cleanupHarnessArtifacts();
  if (cleaned.removed.length) {
    sendUpdateLog({
      stream: 'system',
      line: `已清理旧目录：${cleaned.removed.map((p) => require('path').basename(p)).join(', ')}`,
    });
  }
  return readVersionJson(harnessRoot());
}

async function applyRestoreSeed() {
  if (isUpdateInFlight()) {
    throw new Error('更新进行中，请稍候');
  }
  sendUpdateLog({ stream: 'system', line: '开始从安装包种子恢复' });
  if (mainWindow && !mainWindow.isDestroyed()) {
    loadSplash();
  }
  sendCoreProgress({ message: '正在从种子恢复', stage: 'restore' });
  sendUpdateLog({ stream: 'system', line: '停止当前 Harness…' });
  await harness?.stop();
  await restoreHarnessFromSeed({
    onProgress: (p) => sendCoreProgress(p),
    onLog: (entry) => sendUpdateLog(entry),
  });
  sendUpdateLog({ stream: 'system', line: '正在重启 Harness…' });
  await restartHarnessFresh();
  sendUpdateLog({ stream: 'system', line: 'Harness 已重启' });
  const cleaned = cleanupHarnessArtifacts();
  if (cleaned.removed.length) {
    sendUpdateLog({
      stream: 'system',
      line: `已清理旧目录：${cleaned.removed.map((p) => require('path').basename(p)).join(', ')}`,
    });
  }
  return readVersionJson(harnessRoot());
}

function buildMenu() {
  const template = [
    {
      label: '应用',
      submenu: [
        {
          label: '重新加载界面',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (harness?.url) mainWindow?.loadURL(harness.url);
            else loadSplash();
          },
        },
        {
          label: '重启 Harness',
          click: async () => {
            try {
              await restartHarnessFresh();
            } catch (error) {
              dialog.showErrorBox('重启失败', String(error));
            }
          },
        },
        { type: 'separator' },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 DeepSeek Harness',
              message: 'DeepSeek Harness 桌面宿主',
              detail: aboutMessage(),
            });
          },
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: 'Harness',
      submenu: [
        {
          label: '打开运行时目录',
          click: () => shell.openPath(harnessRoot()),
        },
        {
          label: '打开 sidecar 根目录',
          click: () => shell.openPath(writableDesktopRoot()),
        },
      ],
    },
    {
      label: '数据',
      submenu: [
        {
          label: '打开数据目录',
          click: () => shell.openPath(dshHome()),
        },
        {
          label: '打开工作区',
          click: () => shell.openPath(workspaceDir(dshHome())),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function coreOverview() {
  const { seedDshVersion } = require('./paths');
  const harnessVer = readVersionJson(harnessRoot()) || {};
  const shellPkg = readShellManifest();
  return {
    shellVersion: shellPkg.version,
    seedVersion: seedDshVersion(),
    harnessRoot: harnessRoot(),
    writableRoot: writableDesktopRoot(),
    dshHome: dshHome(),
    shellUpdate: shellUpdateStatus(),
    harness: {
      dsh: harnessVer.dsh || null,
      node: harnessVer.node || null,
      source: harnessVer.source || null,
      installedAt: harnessVer.installedAt || null,
    },
    readyUrl: harness?.url ?? null,
  };
}

async function coreInstallHarness(version) {
  try {
    return await applyInstallVersion(String(version || ''));
  } catch (error) {
    try {
      await restartHarnessFresh();
    } catch {
      // ignore
    }
    throw error;
  }
}

async function coreRestoreSeed() {
  try {
    return await applyRestoreSeed();
  } catch (error) {
    try {
      await restartHarnessFresh();
    } catch {
      // ignore
    }
    throw error;
  }
}

async function coreOpenPath(which) {
  const map = {
    harness: harnessRoot(),
    sidecar: writableDesktopRoot(),
    data: dshHome(),
    workspace: workspaceDir(dshHome()),
  };
  const target = map[which];
  if (!target) throw new Error(`未知路径: ${which}`);
  await shell.openPath(target);
  return target;
}

function coreDiagnose() {
  const { spawnSync } = require('child_process');
  const { nodePathIn, resolveDshEntryIn, harnessLooksComplete } = require('./paths');
  const root = harnessRoot();
  if (!harnessLooksComplete(root)) {
    return { ok: false, error: `Harness 不完整: ${root}` };
  }
  const nodeBinary = nodePathIn(root);
  const entry = resolveDshEntryIn(root);
  const help = spawnSync(nodeBinary, [entry, '--help'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    ok: help.status === 0,
    status: help.status,
    stdout: help.stdout || '',
    stderr: help.stderr || '',
    node: nodeBinary,
    entry,
  };
}

function coreCleanup() {
  const cleaned = cleanupHarnessArtifacts();
  return {
    removed: cleaned.removed,
    harnessRoot: harnessRoot(),
  };
}

async function coreRestartHarness() {
  if (isUpdateInFlight()) {
    throw new Error('更新进行中，请稍候');
  }
  if (!harness) {
    throw new Error('Harness 尚未初始化');
  }
  sendUpdateLog({ stream: 'system', line: '正在重启 Harness…' });
  await restartHarnessFresh();
  sendUpdateLog({ stream: 'system', line: 'Harness 已重启' });
  return coreOverview();
}

async function coreCheckShellUpdate() {
  return checkShellUpdate({
    onProgress: (p) => sendCoreProgress(p),
    onLog: (entry) => sendUpdateLog(entry),
  });
}

async function coreInstallShellUpdate() {
  if (isUpdateInFlight()) {
    throw new Error('核心更新进行中，请稍候');
  }
  sendUpdateLog({ stream: 'system', line: '准备安装桌面壳更新…' });
  try {
    await harness?.stop();
  } catch (error) {
    sendUpdateLog({ stream: 'stderr', line: `停止 Harness 时出错：${error.message || error}` });
  }
  return downloadAndInstallShellUpdate({
    onProgress: (p) => sendCoreProgress(p),
    onLog: (entry) => sendUpdateLog(entry),
  });
}

function registerIpc() {
  ipcMain.handle('desktop:info', () => {
    const harnessVer = readVersionJson(harnessRoot()) || {};
    const shellPkg = readShellManifest();
    return {
      dshHome: dshHome(),
      harnessRoot: harnessRoot(),
      shellVersion: shellPkg.version,
      harnessVersion: harnessVer.dsh || null,
      url: harness?.url ?? null,
      logs: logBuffer.slice(-80),
    };
  });

  ipcMain.handle('core:overview', () => coreOverview());
  ipcMain.handle('core:checkHarness', async () => checkHarnessUpdates());
  ipcMain.handle('core:installHarness', async (_event, version) => coreInstallHarness(version));
  ipcMain.handle('core:restoreSeed', async () => coreRestoreSeed());
  ipcMain.handle('core:restartHarness', async () => coreRestartHarness());
  ipcMain.handle('core:checkShellUpdate', async () => coreCheckShellUpdate());
  ipcMain.handle('core:installShellUpdate', async () => coreInstallShellUpdate());
  ipcMain.handle('core:openPath', async (_event, which) => coreOpenPath(which));
  ipcMain.handle('core:diagnose', () => coreDiagnose());
  ipcMain.handle('core:cleanup', () => coreCleanup());
}

async function startCoreBridge() {
  coreBridge = createCoreBridge({
    overview: () => coreOverview(),
    checkHarness: () => checkHarnessUpdates(),
    installHarness: (version) => coreInstallHarness(version),
    restoreSeed: () => coreRestoreSeed(),
    restartHarness: () => coreRestartHarness(),
    checkShellUpdate: () => coreCheckShellUpdate(),
    installShellUpdate: () => coreInstallShellUpdate(),
    openPath: (which) => coreOpenPath(which),
    diagnose: () => coreDiagnose(),
    cleanup: () => coreCleanup(),
  });
  const info = await coreBridge.ready;
  pushLog({ stream: 'system', line: `桌面核心桥已监听 127.0.0.1:${info.port}` });
  return info;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.dsh.desktop');
    registerIpc();
    await startCoreBridge();
    buildMenu();
    createMainWindow();
    try {
      await createRuntime();
      await injectDesktopBridge();
    } catch (error) {
      sendStatus({ phase: 'error', message: String(error) });
      dialog.showErrorBox('无法启动 DeepSeek Harness', String(error));
    }
  });

  app.on('before-quit', async (event) => {
    if (quitting) return;
    if (isShellInstallPending()) {
      quitting = true;
      try {
        await harness?.stop();
      } catch {
        // ignore
      }
      try {
        await coreBridge?.close();
      } catch {
        // ignore
      }
      // 不 preventDefault，让 electron-updater 完成安装器拉起
      return;
    }
    event.preventDefault();
    quitting = true;
    try {
      await harness?.stop();
      await coreBridge?.close();
    } finally {
      app.exit(0);
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
