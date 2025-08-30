chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "MUSIC_DATA") {
    fetch("http://localhost:3000/vk-discord-rpc-music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.data),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log("Data sent successfully:", message.data);
      })
      .catch((error) => {
        console.error(
          "Failed to send music data via background script:",
          error
        );
      });
    return true;
  }
});
