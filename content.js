const MUSIC_TITLE_SELECTOR = `[data-testid="audioplayeraudioinfo-title"] span`;
const MUSIC_ARTIST_SELECTOR = `[data-testid="audio-player-block-audio-artists"] span`;
const MUSIC_TIMER_SELECTOR =
  '[data-testid="audio-player-block-progress-time-button"] span';
const MUSIC_SLIDER_SELECTOR = `input[type="hidden"][name="slider"][data-testid="slider_input"]`;
const AUDIO_PLAYER_SELECTOR = `[data-testid="AudioPage_AudioPlayerBlock"]`;
const MUSIC_IMAGE_SELECTOR = `img.vkuiImageBase__imgObjectFitCover`;
const SERVER = "http://localhost:3000/vk-discord-rpc-music";

var currentPlayingMusicData = {};
var currentPlayingMusicKey = "";

function getMusicElements() {
  const titleElement = document.querySelector(MUSIC_TITLE_SELECTOR);
  if (!titleElement) {
    console.warn("Title element was not found");
    return null;
  }

  const artistElement = document.querySelector(MUSIC_ARTIST_SELECTOR);
  if (!artistElement) {
    console.warn("Artist element was not found");
    return null;
  }

  const timerElement = document.querySelector(MUSIC_TIMER_SELECTOR);
  if (!timerElement) {
    console.warn("Timer element was not found");
    return null;
  }

  const sliderInputElement = document.querySelectorAll(
    MUSIC_SLIDER_SELECTOR
  )[1];
  if (!sliderInputElement) {
    console.warn("Slider input not found");
    return null;
  }

  const imageElement = document
    .querySelector(AUDIO_PLAYER_SELECTOR)
    ?.querySelector(MUSIC_IMAGE_SELECTOR);
  if (!imageElement) {
    console.warn("Image element was not found");
  }

  return {
    title: titleElement,
    artist: artistElement,
    timer: timerElement,
    slider: sliderInputElement,
    image: imageElement,
  };
}

function timeToSeconds(time) {
  const [minutes, seconds] = time.split(":").map(Number);
  return minutes * 60 + seconds;
}

function calculateEndTime(progress, listenedTime) {
  if (progress <= 0 || progress > 100) {
    throw new Error("Progress должен быть в диапазоне 0–100 (не включая 0).");
  }
  const duration = listenedTime / (progress / 100);
  const remaining = duration - listenedTime;
  const roundedRemainingSeconds = Math.round(remaining);
  return Date.now() + roundedRemainingSeconds * 1000;
}

var endTimeCache = {};
function getEndTime(musicKey, progress, listenedTime) {
  var endTime = endTimeCache[musicKey];
  if (!endTime || endTime < Date.now()) {
    endTime = calculateEndTime(progress, listenedTime);
    endTimeCache[musicKey] = endTime;
  }
  return endTime;
}

function getMusicDataFromElements(musicElements) {
  if (!musicElements) {
    return null;
  }

  const musicData = {
    title: musicElements.title.innerText,
    artist: musicElements.artist.innerText,
    thumbnailUrl: musicElements.image?.src || "",
  };

  const listenProgress = parseFloat(musicElements.slider.value);
  const listenTime = timeToSeconds(musicElements.timer.innerText);
  const startTimestamp = Date.now() - listenTime * 1000;
  const endTimestamp = getEndTime(
    getMusicKeyFromData(musicData),
    listenProgress,
    listenTime
  );
  musicData.listenStartTimestamp = startTimestamp;
  musicData.listenEndTimestamp = endTimestamp;

  console.group("=== Дебаг музыки ===");
  console.log("listenProgress:", listenProgress);
  console.log("listenTime (сек):", listenTime);
  console.log("startTimestamp:", startTimestamp, new Date(startTimestamp));
  console.log("endTimestamp:", endTimestamp, new Date(endTimestamp));
  console.log("время осталось (сек):", (endTimestamp - Date.now()) / 1000);
  console.log("текущее время:", Date.now(), new Date());
  console.log(
    "разница start->now:",
    (Date.now() - startTimestamp) / 1000,
    "сек"
  );
  console.groupEnd("====================");
  return musicData;
}

function getMusicKeyFromData(musicData) {
  const musicKey = `${musicData.artist}_${musicData.title}`;
  return musicKey;
}

function sendMusicData(musicData) {
  console.log("Attempt to send music data:", musicData);
  chrome.runtime.sendMessage(
    {
      type: "MUSIC_DATA",
      data: musicData,
    },
    (response) => {
      console.log("Message sent to background script");
    }
  );
}

function updateMusicData() {
  const elements = getMusicElements();
  if (!elements) {
    console.warn("Could not get music elements");
    return;
  }
  const musicData = getMusicDataFromElements(elements);
  if (!musicData) {
    console.warn("Could not get music data");
    return;
  }
  const thisMusicKey = getMusicKeyFromData(musicData);
  if (currentPlayingMusicKey !== thisMusicKey) {
    endTimeCache[currentPlayingMusicKey] = null;
  }
  currentPlayingMusicKey = thisMusicKey;
  sendMusicData(musicData);
}

setInterval(updateMusicData, 2000);
