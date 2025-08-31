const application = {
  updateInterval: 2000,
  usingPort: 3000,
  updateEvent: "vk-discord-rpc-music",
  noPortServer: "http://localhost:",
};

const audioInfoMap = {
  name: 3,
  author: 4,
  likeInfo: 12,
  thumbnailUrl: 14,
  audioData: 15,
};

// Функция для декодирования HTML-сущностей
function decodeHtml(html) {
  if (!html) return html;
  return new DOMParser().parseFromString(html, "text/html").documentElement
    .textContent;
}

async function fetchAudioDataViaScripting(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN", // исполнение в контексте страницы
      func: (audioInfoMap) => {
        try {
          function decodeHtml(html) {
            if (!html) return html;
            return new DOMParser().parseFromString(html, "text/html")
              .documentElement.textContent;
          }

          const AudioPlayerManager = {
            getAudioPlayer() {
              return typeof window.getAudioPlayer === "function"
                ? window.getAudioPlayer()
                : null;
            },
            getAudio() {
              const player = this.getAudioPlayer();
              return player && typeof player.getCurrentAudio === "function"
                ? player.getCurrentAudio()
                : null;
            },
            getName() {
              const audio = this.getAudio();
              return audio ? audio[audioInfoMap.name] : null;
            },
            getAuthor() {
              const audio = this.getAudio();
              return audio ? audio[audioInfoMap.author] : null;
            },
            getThumbnailUrl() {
              const audio = this.getAudio();
              return audio ? audio[audioInfoMap.thumbnailUrl] : null;
            },
            getVolume() {
              const player = this.getAudioPlayer();
              return player && typeof player.getVolume === "function"
                ? player.getVolume()
                : null;
            },
            isPlaying() {
              const player = this.getAudioPlayer();
              return player && typeof player.isPlaying === "function"
                ? player.isPlaying()
                : null;
            },
            getDuration() {
              const audio = this.getAudio();
              return audio &&
                audio[audioInfoMap.audioData] &&
                audio[audioInfoMap.audioData].duration !== undefined
                ? audio[audioInfoMap.audioData].duration
                : null;
            },
            getListenProgressTime() {
              const player = this.getAudioPlayer();
              return player ? player.getCurrentProgressTime() : null;
            },
            isLike() {
              const audio = this.getAudio();
              return audio &&
                audio[audioInfoMap.likeInfo] &&
                audio[audioInfoMap.likeInfo].like !== undefined
                ? audio[audioInfoMap.likeInfo].like
                : null;
            },
          };

          function getAudioSendData() {
            const sendData = {};
            sendData.name = decodeHtml(AudioPlayerManager.getName());
            sendData.author = decodeHtml(AudioPlayerManager.getAuthor());
            sendData.thumbnailUrl = decodeHtml(
              AudioPlayerManager.getThumbnailUrl()
            );
            sendData.like = AudioPlayerManager.isLike();
            sendData.isPlaying = AudioPlayerManager.isPlaying();
            sendData.volume = AudioPlayerManager.getVolume();
            sendData.duration = AudioPlayerManager.getDuration();
            sendData.listenProgressTime =
              AudioPlayerManager.getListenProgressTime();
            return { success: true, data: sendData };
          }

          return getAudioSendData();
        } catch (err) {
          return {
            success: false,
            error: err?.message || String(err),
            stack: err?.stack || null,
          };
        }
      },
      args: [audioInfoMap],
    });

    if (!results || !results.length)
      throw new Error("No results from executeScript");

    const res = results[0].result;
    if (!res) throw new Error("Empty result from page script");
    if (!res.success) throw new Error(res.error || "Page script error");

    return res.data;
  } catch (e) {
    console.error("[VK RPC] fetchAudioDataViaScripting error:", e);
    throw e;
  }
}

let updateIntervalId = null;
let currentTabId = null;

function onDataReceived(data) {
  const url = "http://localhost:3000/vk-discord-rpc-music";
  console.log("[VK RPC] Отправка данных на сервер:", url, data);
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      console.log("Data sent successfully:", data);
    })
    .catch((error) => {
      console.error("Failed to send music data via background script:", error);
    });
  return true;
}

function startUpdateLoop(tabId) {
  if (updateIntervalId) {
    console.warn(
      "[VK RPC] Цикл обновления уже запущен для вкладки",
      currentTabId
    );
    if (currentTabId !== tabId) stopUpdateLoop();
    else return;
  }

  currentTabId = tabId;
  console.log(
    `[VK RPC] Запуск цикла обновления для вкладки ${tabId} с интервалом ${application.updateInterval}мс`
  );

  updateIntervalId = setInterval(async () => {
    try {
      console.log("[VK RPC] Попытка получить данные аудио...");
      const audioData = await fetchAudioDataViaScripting(tabId);
      console.log("[VK RPC] Данные аудио получены:", audioData);
      onDataReceived(audioData);
    } catch (error) {
      console.error(
        "[VK RPC] Не удалось получить данные аудио:",
        error.message
      );
    }
  }, application.updateInterval);
}

function stopUpdateLoop() {
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
    console.log(
      `[VK RPC] Цикл обновления для вкладки ${currentTabId} остановлен`
    );
    currentTabId = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startAudioTracking") {
    const tabId = sender.tab?.id || message.tabId;
    if (tabId) {
      startUpdateLoop(tabId);
      sendResponse({ success: true, message: "Tracking started" });
    } else {
      sendResponse({ success: false, error: "Tab ID not found" });
    }
    return true;
  } else if (message.action === "stopAudioTracking") {
    stopUpdateLoop();
    sendResponse({ success: true, message: "Tracking stopped" });
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (currentTabId === tabId) stopUpdateLoop();
});

console.log("[VK RPC Background] Скрипт background загружен");
