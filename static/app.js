const $ = (id) => document.getElementById(id);

const languages = [
  ["auto","Auto detect"],["en","English"],["te","Telugu"],["hi","Hindi"],["ta","Tamil"],["kn","Kannada"],["ml","Malayalam"],["bn","Bengali"],["mr","Marathi"],["gu","Gujarati"],["pa","Punjabi"],["ur","Urdu"],["or","Odia"],["as","Assamese"],["ne","Nepali"],["si","Sinhala"],["ar","Arabic"],["zh-CN","Chinese (Simplified)"],["zh-TW","Chinese (Traditional)"],["ja","Japanese"],["ko","Korean"],["th","Thai"],["vi","Vietnamese"],["id","Indonesian"],["ms","Malay"],["fil","Filipino"],["fr","French"],["de","German"],["es","Spanish"],["pt","Portuguese"],["it","Italian"],["nl","Dutch"],["ru","Russian"],["uk","Ukrainian"],["pl","Polish"],["tr","Turkish"],["el","Greek"],["he","Hebrew"],["fa","Persian"],["sw","Swahili"],["af","Afrikaans"],["sq","Albanian"],["am","Amharic"],["az","Azerbaijani"],["eu","Basque"],["be","Belarusian"],["bs","Bosnian"],["bg","Bulgarian"],["ca","Catalan"],["ceb","Cebuano"],["co","Corsican"],["hr","Croatian"],["cs","Czech"],["da","Danish"],["eo","Esperanto"],["et","Estonian"],["fi","Finnish"],["fy","Frisian"],["ga","Irish"],["gd","Scots Gaelic"],["gl","Galician"],["ka","Georgian"],["ht","Haitian Creole"],["ha","Hausa"],["haw","Hawaiian"],["hu","Hungarian"],["is","Icelandic"],["ig","Igbo"],["jw","Javanese"],["kk","Kazakh"],["km","Khmer"],["rw","Kinyarwanda"],["ku","Kurdish"],["ky","Kyrgyz"],["lo","Lao"],["la","Latin"],["lv","Latvian"],["lt","Lithuanian"],["lb","Luxembourgish"],["mk","Macedonian"],["mg","Malagasy"],["mi","Maori"],["mn","Mongolian"],["my","Myanmar"],["ps","Pashto"],["ro","Romanian"],["sm","Samoan"],["sr","Serbian"],["sk","Slovak"],["sl","Slovenian"],["so","Somali"],["su","Sundanese"],["sv","Swedish"],["tg","Tajik"],["tt","Tatar"],["tk","Turkmen"],["ug","Uyghur"],["uz","Uzbek"],["cy","Welsh"],["xh","Xhosa"],["yi","Yiddish"],["yo","Yoruba"],["zu","Zulu"]
];
const supported = new Set(languages.map(x=>x[0]));
const source = $("sourceLang"), target = $("targetLang");
function fillSelect(select, includeAuto=false) {
  languages.filter(([code])=>includeAuto || code!=="auto").forEach(([code,name])=>{
    const option=document.createElement("option"); option.value=code; option.textContent=name; select.appendChild(option);
  });
}
fillSelect(source,true); fillSelect(target,false);
source.value="auto"; target.value="en";
const languageName=(code)=>languages.find(x=>x[0]===code)?.[1] || code;
function updateBadges(){
  $("sourceBadge").textContent=source.value==="auto"?"Auto detect":languageName(source.value);
  $("targetBadge").textContent=languageName(target.value);
}
source.addEventListener("change",updateBadges); target.addEventListener("change",updateBadges);
$("swapBtn").addEventListener("click",()=>{
  if(source.value==="auto"){setNotice("Choose a specific source language before swapping.");return;}
  const old=source.value; source.value=target.value; target.value=old; updateBadges();
});
const sourceText=$("sourceText");
sourceText.addEventListener("input",()=>{$("charCount").textContent=`${sourceText.value.length} / 5000`;});
$("clearBtn").addEventListener("click",()=>{sourceText.value="";$("charCount").textContent="0 / 5000";setNotice("");$("speechStatus").textContent="Text cleared.";});
function setNotice(msg){$("translateStatus").textContent=msg;}
function setResult(text){$("resultText").textContent=text;$("resultText").classList.toggle("empty",!text);$("speakBtn").disabled=!text;$("copyBtn").disabled=!text;}
setResult("");

$("translateBtn").addEventListener("click",async()=>{
  const text=sourceText.value.trim();
  if(!text){setNotice("Enter a message or use the microphone first.");sourceText.focus();return;}
  if(!target.value){setNotice("Choose a target language.");return;}
  $("translateBtn").disabled=true;$("translateBtn").querySelector("span").textContent="Translating…";setNotice("");
  try{
    const response=await fetch("/api/translate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,source:source.value,target:target.value})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.detail||"Translation failed.");
    setResult(data.translatedText);$("resultMeta").textContent=`Translated to ${languageName(target.value)}`;setNotice("");
  }catch(err){setNotice(err.message||"Could not translate. Check your connection and try again.");}
  finally{$("translateBtn").disabled=false;$("translateBtn").querySelector("span").textContent="Translate message";}
});
$("copyBtn").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText($("resultText").textContent);$("resultMeta").textContent="Copied to clipboard";}
  catch{setNotice("Clipboard access is unavailable. Select and copy the translation manually.");}
});
$("speakBtn").addEventListener("click",()=>{
  const text=$("resultText").textContent;if(!text)return;
  if(!("speechSynthesis" in window)){setNotice("Speech playback is not supported by this browser.");return;}
  window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);
  const localeMap={"zh-CN":"zh-CN","zh-TW":"zh-TW","fil":"fil-PH","te":"te-IN","hi":"hi-IN","ta":"ta-IN","kn":"kn-IN","ml":"ml-IN","bn":"bn-IN","mr":"mr-IN","gu":"gu-IN","pa":"pa-IN","ur":"ur-IN"};
  utterance.lang=localeMap[target.value]||target.value;utterance.onerror=()=>setNotice("Speech playback failed or this voice is not installed.");
  window.speechSynthesis.speak(utterance);
});

let recognition=null, listening=false;
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
function speechLocale(code){
  const map={"te":"te-IN","hi":"hi-IN","ta":"ta-IN","kn":"kn-IN","ml":"ml-IN","bn":"bn-IN","mr":"mr-IN","gu":"gu-IN","pa":"pa-IN","ur":"ur-IN","en":"en-US","zh-CN":"zh-CN","zh-TW":"zh-TW"};
  return map[code]||code;
}
function stopListening(){if(recognition){try{recognition.stop()}catch{}} listening=false;$("listenBtn").classList.remove("listening");$("listenLabel").textContent="Start listening";}
$("listenBtn").addEventListener("click",()=>{
  if(listening){stopListening();$("speechStatus").textContent="Stopping microphone…";return;}
  if(!SpeechRecognition){$("speechStatus").textContent="Speech recognition is not supported in this browser. Try a recent version of Chrome or Edge, or type your message.";return;}
  recognition=new SpeechRecognition();recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;
  recognition.lang=speechLocale(source.value==="auto"?"en":source.value);
  recognition.onstart=()=>{listening=true;$("listenBtn").classList.add("listening");$("listenLabel").textContent="Stop listening";$("speechStatus").textContent=`Listening in ${languageName(source.value)}. Speak clearly.`;};
  recognition.onresult=(event)=>{
    let finalText="", interim="";
    for(let i=event.resultIndex;i<event.results.length;i++){const transcript=event.results[i][0].transcript;if(event.results[i].isFinal)finalText+=transcript;else interim+=transcript;}
    if(finalText){sourceText.value=(sourceText.value.trim()?sourceText.value.trim()+" ":"")+finalText.trim();$("charCount").textContent=`${sourceText.value.length} / 5000`;}
    $("speechStatus").textContent=interim?`Hearing: “${interim}”`:"Speech captured. You can edit the text before translating.";
  };
  recognition.onerror=(event)=>{$("speechStatus").textContent=event.error==="not-allowed"?"Microphone permission was denied. Allow access in your browser settings.":`Speech recognition error: ${event.error}. You can type your message instead.`;stopListening();};
  recognition.onend=()=>{if(listening){listening=false;$("listenBtn").classList.remove("listening");$("listenLabel").textContent="Start listening";}$("speechStatus").textContent=$("sourceText").value.trim()?"Speech session ended. Review the text, then translate.":"Microphone is off.";};
  try{recognition.start();}catch{$("speechStatus").textContent="Could not start the microphone. Wait a moment and try again.";}
});

// Camera + MediaPipe hand landmarks: generic pose demo only, not ISL recognition.
const video=$("cameraVideo"), canvas=$("cameraCanvas"), ctx=canvas.getContext("2d");
let cameraStream = null;
let landmarker = null;
let visionModule = null;
let cameraLoop = null;
let lastVideoTime = -1;
let stableGesture = "No hand detected yet";
let candidateGesture = "";
let candidateFrames = 0;

const REQUIRED_STABLE_FRAMES = 5;
const cameraStage = document.querySelector(".camera-stage");

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
      "Could not load hand tracking. Check the browser console and internet connection."
    );
  }
}




function genericPose(points) {
  if (!points || points.length < 21) {
    return "No hand detected";
  }

  // Finger tips and joints (MediaPipe hand landmarks)
  const indexUp = points[8].y < points[6].y;
  const middleUp = points[12].y < points[10].y;
  const ringUp = points[16].y < points[14].y;
  const pinkyUp = points[20].y < points[18].y;

  // Approximate thumb extension using landmark distances
  const distance = (a, b) =>
    Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);

  const thumbUp =
    distance(4, 5) > distance(3, 5) * 1.15;

  const fingers = [indexUp, middleUp, ringUp, pinkyUp];
  const extendedCount = fingers.filter(Boolean).length;

  // All four fingers and thumb extended
  if (extendedCount === 4 && thumbUp) {
    return "HELLO";
  }

  // Four fingers folded, thumb pointing upward
  if (
     extendedCount === 0 &&
     thumbUp &&
     points[4].y < points[3].y
  )  {
     return "THUMBS UP";
   }

  // Index finger extended, remaining fingers folded
  if (
    indexUp &&
    !middleUp &&
    !ringUp &&
    !pinkyUp
  ) {
    return "ONE";
  }

  // All fingers folded
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



function drawResults(result){
  const w=video.videoWidth,h=video.videoHeight;if(!w||!h)return;
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.clearRect(0,0,w,h);
  
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
  hands.forEach(points=>{
    ctx.lineWidth=3;ctx.strokeStyle="#6fe3d0";ctx.fillStyle="#b6aaff";
    links.forEach(([a,b])=>{ctx.beginPath();ctx.moveTo(points[a].x*w,points[a].y*h);ctx.lineTo(points[b].x*w,points[b].y*h);ctx.stroke();});
    points.forEach(p=>{ctx.beginPath();ctx.arc(p.x*w,p.y*h,4,0,Math.PI*2);ctx.fill();});
  });
}
function processCamera(){
  if(!cameraStream||!landmarker)return;
  if(video.readyState>=2&&video.currentTime!==lastVideoTime){
    lastVideoTime=video.currentTime;
    try{const results=landmarker.detectForVideo(video,performance.now());drawResults(results);}
    catch(e){$("cameraStatus").textContent="Hand tracking encountered an error. Try restarting the camera.";}
  }
  cameraLoop=requestAnimationFrame(processCamera);
}
$("cameraBtn").addEventListener("click",async()=>{
  $("cameraBtn").disabled=true;$("cameraStatus").textContent="Starting camera and loading hand tracking…";
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera access requires a supported browser on localhost or HTTPS.");
    cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:400}},audio:false});
    video.srcObject=cameraStream;await video.play();await setupLandmarker();
    cameraStage.classList.add("active");$("cameraPlaceholder").hidden=true;$("cameraStopBtn").disabled=false;$("cameraChip").textContent="Camera active";
    $("cameraStatus").textContent="Hand landmarks are processed in this browser. Generic pose labels are not ISL translations.";
    processCamera();
  }catch(err){
    if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;
    $("cameraStatus").textContent=err.message||"Could not start the camera. Check permissions and try again.";
  }finally{$("cameraBtn").disabled=false;}
});
$("cameraStopBtn").addEventListener("click",()=>{
  if(cameraLoop)cancelAnimationFrame(cameraLoop);cameraLoop=null;
  if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;video.srcObject=null;
  ctx.clearRect(0,0,canvas.width,canvas.height);cameraStage.classList.remove("active");$("cameraPlaceholder").hidden=false;
  $("cameraStopBtn").disabled=true;$("cameraChip").textContent="Camera off";$("cameraStatus").textContent="Camera is off. Video processing runs in this browser.";$("gestureResult").textContent="No hand detected yet";
});
window.addEventListener("beforeunload",()=>{stopListening();if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());if(landmarker)landmarker.close();});
updateBadges();
