'use strict';

const { app } = require('electron');

/** @type {import('electron-updater').AppUpdater | null} */
let updater = null;
let lastCheck = null;
let downloadState = { active: false, percent: 0, transferred: 0, total: 0 };
let shellInstallPending = false;

function getUpdater() {
  if (updater) return updater;
  // Lazy require so unit tests / unpackaged start don't pay cost until needed
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  // Public GitHub Releases — no token required for download
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'ravensu',
    repo: 'deepseek-harness-desktop',
  });
  updater = autoUpdater;
  return updater;
}

function shellUpdateStatus() {
  return {
    packaged: app.isPackaged,
    currentVersion: app.getVersion(),
    lastCheck,
    download: { ...downloadState },
  };
}

/**
 * @param {{ onProgress?: (p: object) => void, onLog?: (e: object) => void }} [hooks]
 */
async function checkShellUpdate(hooks = {}) {
  const { onProgress, onLog } = hooks;
  if (!app.isPackaged) {
    return {
      available: false,
      reason: 'dev',
      message: '开发模式未打包，无法检查壳更新',
      currentVersion: app.getVersion(),
    };
  }

  const autoUpdater = getUpdater();
  onLog?.({ stream: 'system', line: '正在检查桌面壳更新…' });
  onProgress?.({ message: '正在检查壳更新', stage: 'shell-check' });

  try {
    const result = await autoUpdater.checkForUpdates();
    const info = result?.updateInfo;
    const latest = info?.version || null;
    const current = app.getVersion();
    const { compareSemver } = require('./version');
    const available = Boolean(latest && compareSemver(latest, current) > 0);

    lastCheck = {
      at: new Date().toISOString(),
      available,
      latestVersion: latest,
      currentVersion: current,
      releaseName: info?.releaseName || null,
      releaseNotes: typeof info?.releaseNotes === 'string' ? info.releaseNotes : null,
    };

    onLog?.({
      stream: 'system',
      line: available
        ? `发现壳更新：${current} → ${latest}`
        : `壳已是最新：${current}${latest ? `（远端 ${latest}）` : ''}`,
    });
    onProgress?.({
      message: available ? `可更新到 ${latest}` : '壳已是最新',
      stage: available ? 'shell-available' : 'shell-current',
    });

    return {
      available,
      reason: available ? 'update' : 'current',
      message: available ? `可更新到 ${latest}` : '已是最新',
      currentVersion: current,
      latestVersion: latest,
      releaseName: lastCheck.releaseName,
      releaseNotes: lastCheck.releaseNotes,
    };
  } catch (error) {
    const message = String(error.message || error);
    onLog?.({ stream: 'stderr', line: `检查壳更新失败：${message}` });
    onProgress?.({ message, stage: 'error' });
    throw error;
  }
}

/**
 * Download then quitAndInstall. Caller should stop harness first if desired.
 * @param {{ onProgress?: (p: object) => void, onLog?: (e: object) => void }} [hooks]
 */
async function downloadAndInstallShellUpdate(hooks = {}) {
  const { onProgress, onLog } = hooks;
  if (!app.isPackaged) {
    throw new Error('开发模式未打包，无法安装壳更新');
  }

  const autoUpdater = getUpdater();

  if (!lastCheck?.available) {
    const check = await checkShellUpdate(hooks);
    if (!check.available) {
      throw new Error(check.message || '没有可用的壳更新');
    }
  }

  downloadState = { active: true, percent: 0, transferred: 0, total: 0 };
  onLog?.({ stream: 'system', line: '开始下载壳更新…' });
  onProgress?.({ message: '正在下载壳更新', stage: 'shell-download', percent: 0 });

  await new Promise((resolve, reject) => {
    const onProgressEvt = (progress) => {
      downloadState = {
        active: true,
        percent: progress.percent || 0,
        transferred: progress.transferred || 0,
        total: progress.total || 0,
      };
      onProgress?.({
        message: `下载壳更新 ${Math.floor(progress.percent || 0)}%`,
        stage: 'shell-download',
        percent: progress.percent,
      });
    };
    const onDone = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      autoUpdater.off('download-progress', onProgressEvt);
      autoUpdater.off('update-downloaded', onDone);
      autoUpdater.off('error', onError);
    };

    autoUpdater.on('download-progress', onProgressEvt);
    autoUpdater.once('update-downloaded', onDone);
    autoUpdater.once('error', onError);

    autoUpdater.downloadUpdate().catch(onError);
  });

  downloadState = { ...downloadState, active: false, percent: 100 };
  onLog?.({ stream: 'system', line: '壳更新已下载，即将安装并重启应用…' });
  onProgress?.({ message: '正在安装壳更新', stage: 'shell-install' });

  shellInstallPending = true;
  // isSilent=false, isForceRunAfter=true
  autoUpdater.quitAndInstall(false, true);
  return { ok: true, installing: true };
}

function isShellInstallPending() {
  return shellInstallPending;
}

module.exports = {
  shellUpdateStatus,
  checkShellUpdate,
  downloadAndInstallShellUpdate,
  isShellInstallPending,
};
