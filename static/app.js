const $ = (id) => document.getElementById(id);

// Camera and MediaPipe hand landmarks.
// This is a generic hand-pose demo, not an ISL translation model.

const video = $("cameraVideo");
const canvas = $("cameraCanvas");
const ctx = canvas.getContext("2d");

let cameraStream = null;
let landmarker = null;
let visionModule = null;
let cameraLoop = null;
let lastVideoTime = -1;
let cameraStarting = false;

let stableGesture = "No hand detected yet";
let candidateGesture = "";
let candidateFrames = 0;

const REQUIRED_STABLE_FRAMES = 5;
const cameraStage = document.querySelector(".camera-stage");

let gestureWords = [];

async function setupLandmarker() {
  if (landmarker) return landmarker;

  try {
    visionModule = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm"
    );

    const vision = await visionModule.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    landmarker = await visionModule.HandLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "CPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      }
    );

    return landmarker;
  } catch (error) {
    console.error("MediaPipe loading failed:", error);

    throw new Error(
      "Could not load hand tracking. Check your internet connection and try again."
    );
  }
}

function genericPose(points) {
  if (!points || points.length < 21) {
    return "No hand detected";
  }

  // Finger tips and joints.
  const indexUp = points[8].y < points[6].y;
  const middleUp = points[12].y < points[10].y;
  const ringUp = points[16].y < points[14].y;
  const pinkyUp = points[20].y < points[18].y;

  // Approximate thumb extension.
  const distance = (a, b) =>
    Math.hypot(
      points[a].x - points[b].x,
      points[a].y - points[b].y
    );

  const thumbUp = distance(4, 5) > distance(3, 5) * 1.15;

  const fingers = [indexUp, middleUp, ringUp, pinkyUp];
  const extendedCount = fingers.filter(Boolean).length;

  // Open palm.
  if (extendedCount === 4 && thumbUp) {
    return "HELLO";
  }

  // Thumb-up pose.
  if (
    extendedCount === 0 &&
    thumbUp &&
    points[4].y < points[3].y
  ) {
    return "THUMBS UP";
  }

  // One raised finger.
  if (
    indexUp &&
    !middleUp &&
    !ringUp &&
    !pinkyUp
  ) {
    return "ONE";
  }

  // Closed fist.
  if (extendedCount === 0) {
    return "FIST";
  }

  return "Unknown gesture";
}

function stabilizeGesture(rawGesture) {
  if (rawGesture !== candidateGesture) {
    candidateGesture = rawGesture;
    candidateFrames = 1;
  } else {
    candidateFrames++;
  }

  if (candidateFrames >= REQUIRED_STABLE_FRAMES) {
    stableGesture = candidateGesture;
  }

  return stableGesture;
}

function drawResults(result) {
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (!width || !height) return;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.clearRect(0, 0, width, height);

  const hands = result.landmarks || [];

  if (!hands.length) {
    candidateGesture = "";
    candidateFrames = 0;
    stableGesture = "No hand detected yet";

    $("gestureResult").textContent = stableGesture;
    $("cameraChip").textContent = "Searching for hands…";
    return;
  }

  const rawGesture = hands.map(genericPose).join(" · ");

  $("gestureResult").textContent = stabilizeGesture(rawGesture);

  $("cameraChip").textContent =
    `${hands.length} hand${hands.length === 1 ? "" : "s"} tracked`;

  const links = visionModule.HandLandmarker.HAND_CONNECTIONS;

  hands.forEach((points) => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#6fe3d0";
    ctx.fillStyle = "#b6aaff";

    links.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(points[a].x * width, points[a].y * height);
      ctx.lineTo(points[b].x * width, points[b].y * height);
      ctx.stroke();
    });

    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(
        point.x * width,
        point.y * height,
        4,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
  });
}

function processCamera() {
  if (!cameraStream || !landmarker) return;

  if (
    video.readyState >= 2 &&
    video.currentTime !== lastVideoTime
  ) {
    lastVideoTime = video.currentTime;

    try {
      const results = landmarker.detectForVideo(
        video,
        performance.now()
      );

      drawResults(results);
    } catch (error) {
      console.error("Hand tracking error:", error);
      $("cameraStatus").textContent =
        "Hand tracking encountered an error. Try restarting the camera.";
    }
  }

  cameraLoop = requestAnimationFrame(processCamera);
}

function stopCamera() {
  if (cameraLoop !== null) {
    cancelAnimationFrame(cameraLoop);
    cameraLoop = null;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  cameraStage.classList.remove("active");
  $("cameraPlaceholder").hidden = false;

  $("cameraBtn").disabled = false;
  $("cameraStopBtn").disabled = true;

  $("cameraChip").textContent = "Camera off";
  $("cameraStatus").textContent =
    "Camera is off. Video processing runs in this browser.";

  $("gestureResult").textContent = "No hand detected yet";

  stableGesture = "No hand detected yet";
  candidateGesture = "";
  candidateFrames = 0;
  lastVideoTime = -1;
}

$("cameraBtn").addEventListener("click", async () => {
  if (cameraStarting || cameraStream) return;

  cameraStarting = true;
  $("cameraBtn").disabled = true;
  $("cameraStatus").textContent =
    "Starting camera and loading hand tracking…";

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Camera access requires a supported browser and HTTPS."
      );
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 400 }
      },
      audio: false
    });

    video.srcObject = cameraStream;
    await video.play();

    await setupLandmarker();

    cameraStage.classList.add("active");
    $("cameraPlaceholder").hidden = true;
    $("cameraStopBtn").disabled = false;
    $("cameraChip").textContent = "Camera active";

    $("cameraStatus").textContent =
      "Hand tracking is active. Recognized labels are generic poses, not ISL translations.";

    lastVideoTime = -1;
    processCamera();
  } catch (error) {
    console.error("Camera startup failed:", error);

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }

    video.srcObject = null;

    $("cameraStatus").textContent =
      error.message || "Could not start the camera. Check permissions and try again.";

    $("cameraBtn").disabled = false;
  } finally {
    cameraStarting = false;
  }
});

$("cameraStopBtn").addEventListener("click", stopCamera);

// Gesture-to-text.

$("addGestureBtn").addEventListener("click", () => {
  const gesture = $("gestureResult").textContent.trim();

  const allowedGestures = [
    "HELLO",
    "FIST",
    "ONE",
    "THUMBS UP"
  ];

  if (!allowedGestures.includes(gesture)) {
    $("gestureSentence").textContent =
      "Hold a recognized gesture before adding it.";
    return;
  }

  gestureWords.push(gesture);
  $("gestureSentence").textContent = gestureWords.join(" ");
});

$("clearGestureBtn").addEventListener("click", () => {
  gestureWords = [];
  $("gestureSentence").textContent = "Your sentence will appear here.";
});

$("copyGestureBtn").addEventListener("click", async () => {
  if (gestureWords.length === 0) {
    $("gestureSentence").textContent =
      "There is no text to copy yet.";
    return;
  }

  try {
    await navigator.clipboard.writeText(gestureWords.join(" "));

    $("gestureSentence").textContent =
      gestureWords.join(" ") + " (Copied!)";
  } catch (error) {
    $("gestureSentence").textContent =
      "Copy failed. Please select and copy the text manually.";
  }
});

$("speakGestureBtn").addEventListener("click", () => {
  const text = gestureWords.join(" ").trim();

  if (!text) {
    $("gestureSentence").textContent =
      "Add a gesture before speaking.";
    return;
  }

  if (!("speechSynthesis" in window)) {
    $("gestureSentence").textContent =
      "Speech synthesis is not supported in this browser.";
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;

  window.speechSynthesis.speak(utterance);
});

window.addEventListener("beforeunload", () => {
  if (cameraLoop !== null) {
    cancelAnimationFrame(cameraLoop);
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
  }

  if (landmarker) {
    landmarker.close();
  }
});
