// content.js

// При загрузке content script, уведомляем background о необходимости начать отслеживание
// для этой вкладки.
chrome.runtime.sendMessage({ action: "startAudioTracking" }, (response) => {
  if (chrome.runtime.lastError) {
    console.error(
      "[VK RPC Content] Ошибка при отправке сообщения startAudioTracking:",
      chrome.runtime.lastError.message
    );
    return;
  }
  if (response && response.success) {
    console.log("[VK RPC Content] Отслеживание аудио запущено");
  } else {
    console.error(
      "[VK RPC Content] Ошибка при запуске отслеживания:",
      response ? response.error : "Неизвестная ошибка"
    );
  }
});

// Опционально: останавливаем отслеживание, когда content script "уничтожается"
// (например, при переходе на другую страницу в той же вкладке)
// window.addEventListener('beforeunload', () => {
//   chrome.runtime.sendMessage({ action: "stopAudioTracking" });
// });

console.log("[VK RPC Content] Content script загружен");
