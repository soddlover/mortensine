localStorage.setItem('serverStarted', 'true');
let socketInstance = null;

if (!localStorage.getItem('neverAskAgain')) {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
    } else if (Notification.permission !== 'granted'){
        Swal.fire({
            title: 'Trykk på godta notifications på promt eller evt trykk bjelle tegnet oppe og aktiver manuelt?',
            showDenyButton: true,
            confirmButtonText: `TRYKK MEG`,
            denyButtonText: `Jeg gidder ikke, aldri spør meg igjen (ikke vær så teit a)`,
        }).then((result) => {
            if (result.isConfirmed) {
                if (Notification.permission !== 'granted') {
                    Notification.requestPermission().then(function (permission) {
                        if (permission === "granted") {
                            Swal.fire({
                                title: 'Notifications enabled BABY! \n Nice! \n Velg hvilke typer notifications du får fra brukersiden',
                                confirmButtonText: `Enable Audio`,
                            }).then((result) => {
                                if (result.isConfirmed) {
                                    var audio = new Audio('intro.mp3');
                                    audio.play();
                                }
                            });
                        }
                    });
                }
            } else if (result.isDenied){
                localStorage.setItem('neverAskAgain', true);
            }
        })
    }
}
document.addEventListener('DOMContentLoaded', init, false);
async function init() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker-index.js')
            .then(function(registration) {
                // Use the PushManager to get the user's subscription to the push service.
                return registration.pushManager.getSubscription()
                    .then(async function(subscription) {
                        // If a subscription was found, return it.
                        if (subscription) {
                            console.log('Existing subscription found', subscription);
                            return subscription;
                        }

                        // Get the server's public key
                        const response = await fetch('/pushKey');
                        const vapidPublicKey = await response.text();
                        // Chrome doesn't accept the base64-encoded (string) vapidPublicKey yet
                        // urlBase64ToUint8Array() is defined in /tools.js
                        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

                        // Otherwise, subscribe the user (userVisibleOnly allows to specify that we don't plan to
                        // send notifications that don't have a visible effect for the user).
                        return registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: convertedVapidKey
                        });
                    });
            })
            .then(function(subscription) {
                // Send the subscription details to the server using the Fetch API.
                console.log('Subscription object', subscription);

                fetch('/pushSub', {
                    method: 'post',
                    headers: {
                        'Content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        subscription: subscription
                    }),
                });
            });
    }
}

firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
        db.collection('brukere').doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                const preferences = doc.data().notificationPreferences;
                if (preferences) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'SET_PREFERENCES',
                        preferences: preferences
                    });
                    console.log("set preferences");
                }
            } else {
                console.log("No such document!");
            }
        });
    } else {
        console.log('No user is signed in.');
    }
});
let deferredPrompt;


const installModal = document.getElementById('installModal');
const installBtn = document.getElementById('installBtn');
const closeBtn = document.getElementById('closeBtn');
/*
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installModal.style.display = 'block';
});
installBtn.addEventListener('click', (e) => {
    if (localStorage.getItem('prompted') !== 'true') {
      installModal.style.display = 'none';
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
        } else {
          console.log('User dismissed the A2HS prompt');
        }
        deferredPrompt = null;
      });
      localStorage.setItem('prompted', 'true');
    }
  });
  
  closeBtn.addEventListener('click', (e) => {
    installModal.style.display = 'none';
  });
*/



function getSocketInstance() {
    if (!socketInstance) {
        socketInstance = io.connect("https://mortensine.no");
    }
    return socketInstance;
}



function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
   
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
   
    for (var i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

getSocketInstance().on('connect', function () {
    console.log("Connected to server");
    getSocketInstance().on('message', function (data) {
        console.log("recieved message: ", data);
        if (!data) {
            console.error("Received null data");
            return;
        }
        if (!data.type) {
            console.error("Data type is not defined", data);
            return;
        }
        if (data.type === 'examUsers') {
            showTribute(data.examUsers,false);
        } else if (data.type === 'examUsersFinish') {
            showTribute(data.examUsers,true);
        }
        if (data.type === 'welcome') {
          if (data.metode==="eksamen"){
            showExamMessage(data.fornavn, data.sted, data.profilbilde);
          } else{
           showWelcomeMessage(data.fornavn, data.metode, data.sted, data.profilbilde);
          }
        } else if (data.type === 'goodbye') {
          showGoodbyeMessage(data.userID, data.fornavn, data.profilbilde);
        } else if (data.type === "leaderboard"){
            loadLeaderboard(data.userData);
        }else if (data.type ==="lastOutData"){
            setupLastOutListener(data.lastOutArray);
        }else if (data.type ==="earlybirdData"){
            setupEarlybirdListener(data.earlybirdArr);
        }else if (data.type ==="sound"){
            console.log("Sound message: ", data.message);
            //showSoundAuthour(data.message);
        }else if (data.type==="usersList"){
            updateUserslist(data.usersList);
        }
    });
});    
getSocketInstance().on('connect_error', function(error) {
    console.log('Connection failed', error);
});

getSocketInstance().on('disconnect', function () {
    console.log("Disconnected from server");
    if (isMessageShowing) {
        document.getElementById('velkommenSide').classList.add('hidden');
        isMessageShowing = false;
    }
});

function updateUserslist(data){
    const list= JSON.parse(data);
    const rfidUsersList = document.getElementById('rfidUsersList');
    const manualUsersList = document.getElementById('manualUsersList');
    if (!rfidUsersList || !manualUsersList) {
        return;
      }
    // Clear the lists
    rfidUsersList.innerHTML = list.rfidUsers;
    manualUsersList.innerHTML = list.manualUsers;
  
    // Add the RFID users to the list
}

var isMessageShowing = false;
localStorage.setItem('audioPlaying',false);

function showExamMessage(userName, location, profilbildePath) {
    if (isMessageShowing){
        return;
    }
    isMessageShowing = true;
    const eksamenTekst = document.getElementById('eksamenstekst');
    const profileImage = document.getElementById('eksamensbilde');
    var skullContainer = document.querySelector(".skull-container");

    try{
        let [romNr, Fagkode] = location.split("#");         
        eksamenTekst.innerHTML = `<span style="color:red; text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black;">${userName} har stemplet inn fra <u>${romNr}</u> <br> Eksamen: <u>${Fagkode}</u></span>`;
        document.getElementById('EksamensSide').style.backgroundColor = "blueviolet";
        document.getElementById('EksamensSide').classList.remove('hidden');
        skullContainer.style.display = "block";

        profileImage.src = profilbildePath;
    } catch (error){
        console.error("Error showing welcome message: ", error);
    } finally {
        setTimeout(() => {
            document.getElementById('EksamensSide').classList.add('hidden');
            skullContainer.style.display = "none";
            isMessageShowing = false;
        }, 10000);
    }
}


function showWelcomeMessage(userName, loginMethod, loginLocation, profilbildePath) {
    if (isMessageShowing){
        return;
    }
    isMessageShowing = true;
    var velkommenText = document.getElementById('velkommenText');
    const loginInfo = document.getElementById('loginInfo');
    const profileImage = document.getElementById('profileImage');
    try{

        if (loginMethod === 'RFID') {
            velkommenText.innerHTML = `Velkommen ${userName}!`;

            loginInfo.style.display = "none";
        } else if (loginMethod === 'manual') {
            velkommenText.innerHTML = `${userName} har stemplet inn her: ${loginLocation}!`;

        }
        profileImage.src = profilbildePath;
        document.getElementById('velkommenSide').classList.remove('hidden');

        profileImage.src = profilbildePath;
    } catch (error){
        console.error("Error showing welcome message: ", error);
    } finally {
        setTimeout(() => {
            document.getElementById('velkommenSide').classList.add('hidden');
            isMessageShowing = false;
        }, 10000); 
    }


}


function showGoodbyeMessage(userID, userName, profilbildePath) {
    if (isMessageShowing){
        return;
    }
    isMessageShowing = true;
 

    db.collection('brukere').doc(userID).get().then(doc => {
        const userData = doc.data();
        const timeEntered = userData.timeEntered.toDate();
        const timeNow = new Date();
        const durationMs = timeNow - timeEntered;
        const durationMinutes = Math.floor(durationMs / 60000);
        const durationHours = Math.floor(durationMinutes / 60);

        const velkommenText = document.getElementById('velkommenText');
        try {
                
            profileImage.src = profilbildePath;
            velkommenText.innerHTML = `Hade ${userName}! Total tid idag: ${durationHours} timer og ${durationMinutes % 60} minutter.`;
            document.getElementById('velkommenSide').classList.remove('hidden');
            
        } catch (error) {
            console.error("Error showing goodbye message: ", error);
        } finally {
            setTimeout(() => {
                document.getElementById('velkommenSide').classList.add('hidden');
                isMessageShowing = false;
            }, 10000); 
        }

    }).catch(error => {
        console.error("Error getting user document: ", error);
        isMessageShowing = false;
    });
}


function showSoundAuthour(author){
    if (isMessageShowing) {
        setTimeout(showSoundAuthour(author), 500); // Check again in 1 second
    } else {
        const velkommenText = document.getElementById('velkommenText');
        velkommenText.innerHTML = `Lyd lagt inn av: ${author}`;

        document.getElementById('velkommenSide').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('velkommenSide').classList.add('hidden');
        }, 5000); 
    }
}

function loadLeaderboard(usersData) {
    let examInProgress=false;
    htmlContent = '';
    rank = 1;
    const storedLeaderboard = localStorage.getItem('leaderboard');
    if (storedLeaderboard) {
        document.getElementById('leaderboardContent').innerHTML = storedLeaderboard;
    }
    usersData.forEach((userData) => {
        const totalMinutes = userData.totalMinutes || 0;
        const kaffeCount = userData.kaffeCount || 0;
        const quote = encodeHTML(userData.quote || '');
        const totalHours = Math.floor(totalMinutes / 60);
        const totalMinutesLeft = totalMinutes % 60;
        const totalHoursToday = userData.totalHoursToday || 0;
        const pilsCount = userData.pils || 0;
        const eksamen = userData.eksamen || false;
        // Check if the user has punched in today
        const hasPunchedInToday = userData.status === true;

        // Set the row color based on whether the user has punched in today
        let rowColor;
        if (eksamen) {
            rowColor = 'purple';
            examInProgress=true;
        } else {
            rowColor = hasPunchedInToday ? '#9ADE7B' : '#D04848';
        }        
        const changedPosition = userData.changeInPosition || 0;

        // Determine the arrow based on the changedPosition value
        let arrow;
    let arrowClass;

    if (changedPosition > 0) {
        arrow = `<i class="fa-solid fa-arrow-up"></i> ${Math.abs(changedPosition)}`;
        arrowClass = 'arrow-up';
    } else if (changedPosition < 0) {
        arrow = `<i class="fa-solid fa-arrow-down"></i> ${Math.abs(changedPosition)}`;
        arrowClass = 'arrow-down';
    } else {
        arrow = '';
        arrowClass = 'equal-sign';
    }

        htmlContent += `
            <div class="leaderboard" >
                <div class="leaderboardsplit" style="width: 5%;">${rank++}</div>
                <div class="leaderboardsplit" style="width: 10%;">${totalHours}t ${totalMinutesLeft}m</div>
                <div class="leaderboardsplit" style="width: 15%;">${Math.floor(totalHoursToday)}t, ${Math.round((totalHoursToday % 1) * 60)}m i dag</div>
                <div class="leaderboardsplit" style="width: 5%;">${kaffeCount} ☕️</div>
                <div class="leaderboardsplit" style="width: 5%;">${pilsCount} 🍻</div>
                <div class="leaders" style="background-color: ${rowColor}; width=25%;">
                    <span class="name" style="margin-right: 20px;">${userData.fornavn + ' ' + userData.etternavn || 'Unknown'}</span>
                    <span class="quote">${quote}</span></div>
                    <span class="position-change ${arrowClass}">${arrow}</span>
                </div>`;
    });
    leaderboardContent.innerHTML = htmlContent;
    localStorage.setItem('leaderboard', htmlContent);
    if (examInProgress){
        document.getElementById('exam').classList.remove('hidden');
    } else {
        document.getElementById('exam').classList.add('hidden');
    }
}

function toggleMenu() {
    const menuItems = document.querySelector('.menu-items');
    menuItems.classList.toggle('hidden');
}

// function playIceIce() {
//     // Set a flag in LocalStorage
//     localStorage.setItem('playSong', 'true');
// }
// function stopIceIce() {
//     // Set a flag in LocalStorage
//     localStorage.setItem('stopSong', 'true');
// }
function displayLatestProfilbilde() {
db.collection('icestafett').get()
    .then(snapshot => {
        if (snapshot.empty) {
            console.error("Ingen dokumenter i 'icestafett'.");
            return; 
        }
        const lastDoc = snapshot.docs[0];
        const userIDArray = lastDoc.data().userID;
        if (!userIDArray || userIDArray.length === 0) {
            console.error("UserID array er tom.");
            return; 
        }
        const lastUserID = userIDArray[userIDArray.length - 1]; 
        console.log("Siste userID:", lastUserID);

        return db.collection('brukere').doc(lastUserID).get();
    })
    .then(userDoc => {
        if (!userDoc.exists) {
            console.error("Brukerdokument finnes ikke.");
            return; 
        }
        const userData = userDoc.data();
        console.log("Bruker dok data:", userDoc.data());
        const imgElement = document.querySelector('.iceimg');
        const profilbildePath = userData.profilbilde;
        // displayProfilbilde(profilbilde);
        let imageref;
        if (profilbildePath && profilbildePath.startsWith('http')) {
            imageref = storage.refFromURL(profilbildePath);
            console.log("ImageRef:", imageref);
        } else if (profilbildePath) {
            imageref = storage.ref(profilbildePath);
            console.log("ImageRef:", imageref);
        }

    if (imageref) {
        imageref.getDownloadURL().then((url) => {
            iceimg.src = url;
            //iceimg2.src = url;
            //iceimg3.src = url;
        }).catch((error) => {
            console.error("Finner ikke bildet: ", error);
        });
    } else { console.error('Filsti for bilde eksisterer ikke'); }
    })
}

function displayProfilbilde(profilbildePath) {
        const image = document.querySelector('iceimg');
        console.log("Profilbilde path:", profilbildePath);
        let imageRef;
        if (profilbildePath && profilbildePath.startsWith('http')) {
            imageRef = storage.refFromURL(profilbildePath);
            console.log("ImageRef:", imageRef);
        } else if (profilbildePath) {
            imageRef = storage.ref(profilbildePath);
            console.log("ImageRef:", imageRef);
        }

        if (imageRef) {
            imageRef.getDownloadURL().then((url) => {
                image.src = url;
            }).catch((error) => {
                console.error("Finner ikke bildet: ", error);
            });
        } else {
            console.error('Filsti for bilde eksisterer ikke');
        }
    }


displayLatestProfilbilde();
loadLeaderboard();


function setupLastOutListener(lastoutDataArray) {
    lastoutDataArray.forEach((lastoutData, index) => {
        const userID = lastoutData.userID;
        const timeString = lastoutData.timeString;
        const profilbildePath = lastoutData.profilbildePath;

        console.log(`Last out #${index + 1}: ${userID} at ${timeString}`);
        const lastOutTime = document.getElementById(`latebirdTime${index + 1}`);
        if (lastOutTime) {
            lastOutTime.textContent = `Stemplet ut kl. ${timeString}`;
        }

        if (profilbildePath) {
            const lastOutImg = document.getElementById(`latebird${index + 1}`);
            if (lastOutImg) {
                lastOutImg.src = profilbildePath;
            }
        } else {
            console.error("Finner ikke profilbilde.");
        }
    });
    localStorage.setItem('latebird', JSON.stringify(lastoutDataArray));
}



function setupEarlybirdListener(data) {
  // Client-side code
    data.forEach((earlybird, index) => {
        const earlybirdTime = document.getElementById(`earlybirdTime${index + 1}`);
        if (earlybirdTime) {
            earlybirdTime.textContent = `Stemplet inn kl. ${earlybird.timeString}`;
        }

        const earlybirdImg = document.getElementById(`earlybird${index + 1}`);
        if (earlybirdImg && earlybird.profilbildePath) {
            earlybirdImg.src = earlybird.profilbildePath;
        }
    });
    localStorage.setItem('earlybird', JSON.stringify(data));
}

function updateProfilePicture(path) {
    const imgElement = document.getElementById('earlybirdPic');
    imgElement.src = path;
}
function calculateCountdown(targetDateTime) {
    var now = new Date();
    var timeDiff = targetDateTime - now;
  
    var days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((timeDiff % ((1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
    var minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  
    return days + "d " + hours + "t " + minutes + "m ";
  }
  
  db.collection('icestafett').doc('OO6yweoYrlh7mDW5BTLt').get().then(doc => {
    if (!doc.exists) {
      console.error("Document does not exist.");
      return;
    }
    console.log("Document ICE data:", doc.data());
  
    var targetDate = doc.data().tid.toDate(); 
  
    var day = targetDate.getDay();
    var hour = targetDate.getHours();
  
    if ((day === 5 && hour >= 10) || day === 6 || day === 0) {
      var daysUntilMonday;
      if (day === 5 && hour >= 10) {
        daysUntilMonday = 2; 
      } else if (day === 6) {
        daysUntilMonday = 1; 
      } else {
        daysUntilMonday = 0; 
      }
      targetDate.setDate(targetDate.getDate() + daysUntilMonday);
    }
    targetDate.setDate(targetDate.getDate() + 3);
  
    var countdownString = calculateCountdown(targetDate);
    document.getElementById("iceCountdown").innerHTML = "Tid som gjenstår: " + countdownString;
  }).catch(error => {
    console.error("Error getting document: ", error);
  });

  function encodeHTML(quote) {
    let div = document.createElement('div');
    div.innerText = quote;
    return div.innerHTML;
}

function showTribute(usersArray, complete) {
    usersArray.forEach((user, index) => {
        setTimeout(() => {
            // Create a new div for the user's information
            const userDiv = document.createElement('div');
            userDiv.className = 'user-info';
            userDiv.style.position = 'fixed';
            userDiv.style.top = '0';
            userDiv.style.left = '0';
            userDiv.style.width = '100%';
            userDiv.style.height = '100%';
            userDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            userDiv.style.color = 'white';
            userDiv.style.display = 'flex';
            userDiv.style.justifyContent = 'center';
            userDiv.style.alignItems = 'center';
            userDiv.style.flexDirection = 'column';
            userDiv.style.zIndex = '1000';
            userDiv.style.opacity = '0';
            userDiv.style.transition = 'opacity 3s';
            console.log("User:", user);
            console.log("User sted:", user.sted);
            var [romNr, Fagkode] = user.sted.split("#");

            // Add the user's name, place, and profile picture to the div
            userDiv.innerHTML = `
            <h2>A moment of silence, brave scholars, as they embark on the journey of examination...</h2>
            <h1>${user.fornavn}</h1>
            <p><span style="font-size: 1.5em;">${Fagkode}</span></p>
            <p><span style="font-size: 1.5em;">${romNr}</span></p>
            <img src="${user.profilbilde}" style="width: 200px; height: 200px; border-radius: 50%; margin-top: 20px;">
            `;
            if (complete){
                userDiv.innerHTML = `
                <h2>🎉🎉🎉 Congratulations! ${user.fornavn} triumphantly finished the exam! 🎉🎉🎉</h2>
                <p>Finish Time: ${user.finished}</p>
                <p><span style="font-size: 1.5em;">${Fagkode}</span></p>
                <img src="${user.profilbilde}" style="width: 200px; height: 200px; border-radius: 50%; margin-top: 20px;">
            `;
            }

            // Add the div to the page
            document.body.appendChild(userDiv);


            // Fade out and remove the div after 30 seconds
            setTimeout(() => {
                userDiv.style.opacity = '1';
            }, 100);
    
            // Fade out and remove the div after 10 seconds
            setTimeout(() => {
                userDiv.style.opacity = '0';
                setTimeout(() => {
                    userDiv.remove();
                }, 3000); // Wait for the fade out transition to finish before removing the div
            }, 7000); // Start the fade out transition 1 second before the div is removed to allow time for the transition
        }, index * 10000);
    });
}