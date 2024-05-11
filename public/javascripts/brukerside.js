document.addEventListener('DOMContentLoaded', function() {
    auth.onAuthStateChanged((user) => {
    console.log(user)
    if (user) {
        console.log('Bruker er logget inn!');
        db.collection('brukere').doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                const preferences = doc.data().notificationPreferences;
                if (preferences) {
                document.querySelector('#notif_mov').checked = preferences.movements;
                document.querySelector('#notif_ann').checked = preferences.announcements;
                }
                const userData = doc.data();
                const brukernavn = document.getElementById('brukernavn');
                const profilbilde = document.getElementById('profilbilde');
                const kaffeCount = document.getElementById('kaffeStatistikk');
                const profilbildePath = userData.profilbilde;
                const tidsStats = document.getElementById('timestatistikk');
                const hours= Math.floor(userData.totalMinutes/60);
                const minutes = userData.totalMinutes % 60;
                tidsStats.textContent = 'Total tid på skolen: ' + hours + ' timer og ' + minutes + ' minutter';
                displayProfilbilde(profilbildePath);
                brukernavn.textContent = userData.fornavn + ' ' + userData.etternavn;
                if(userData && !userData.kaffeCount) {
                    kaffeCount.textContent = 'Antall kaffekanne traktet: 0';
                } else {
                    kaffeCount.textContent = 'Antall kaffekanner traktet: ' + userData.kaffeCount;
                }

            } else {
                console.log("No such document!");
            }
        }).catch((error) => {
            console.log("Error getting document:", error);
        });
    } else {
        console.log('Ingen bruker logget inn!');
        }
    });

    function displayProfilbilde(profilbildePath) {
        const image = document.querySelector('profilbilde');
        let imageRef;
        if (profilbildePath && profilbildePath.startsWith('http')) {
            imageRef = storage.refFromURL(profilbildePath);
        } else if (profilbildePath) {
            imageRef = storage.ref(profilbildePath);
        }

        if (imageRef) {
            imageRef.getDownloadURL().then((url) => {
                profilbilde.src = url;
            }).catch((error) => {
                console.error("Finner ikke bildet: ", error);
            });
        } else {
            console.error('Filsti for bilde eksisterer ikke');
        }
    }
});

document.querySelector('#notification-preferences').addEventListener('submit', (event) => {
    event.preventDefault();

    const user = firebase.auth().currentUser;
    if (user) {
      const preferences = {
        movements: document.querySelector('#notif_mov').checked,
        announcements: document.querySelector('#notif_ann').checked,
        // Add more types as needed
      };
      if (preferences.movements || preferences.announcements) {
        Notification.requestPermission();
      }
  
      db.collection('brukere').doc(user.uid).update({
        notificationPreferences: preferences
      }).then(() => {
        console.log('Notification preferences updated successfully');
        navigator.serviceWorker.controller.postMessage({
            type: 'SET_PREFERENCES',
            preferences: preferences
          });
        alert('Notification preferences updated successfully');

      }).catch((error) => {
        console.error("Error updating document: ", error);
      });
    } else {
      console.log('User is not logged in');
    }
  });

document.getElementById('uploadButton').addEventListener('click', function() {
    const mp3File = document.getElementById('mp3Upload').files[0];
    const selectedUser = document.getElementById('userSelect').value;
    const author= document.getElementById('brukernavn').textContent;
    if (mp3File && selectedUser) {
        const formData = new FormData();
        formData.append('username', selectedUser);
        formData.append('author', author);
        formData.append('mp3File', mp3File);
        console.log(formData);
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.text())
        .then(result => {
            console.log('File uploaded succesfully');
            document.getElementById('mp3Upload').value = ''; // Clear the file input field
            alert('Filen er lastet opp');
        })

        .catch(error => {
            console.error('Error:', error);
        });

        uploadButton.disabled = true;
        uploadButton.textContent = 'Laster opp...';
        setTimeout(() => {
            uploadButton.disabled = false;
            uploadButton.textContent = 'Last opp';
        }, 3000);

    } else {
        console.log('No file selected or no user selected');
    }
});

const userSelect = document.getElementById('userSelect');

db.collection('brukere').get().then((snapshot) => {
  snapshot.forEach((doc) => {
    const option = document.createElement('option');
    option.value = doc.data().fornavn+' '+doc.data().etternavn;
    option.text = doc.data().fornavn+' '+doc.data().etternavn;
    userSelect.appendChild(option);
  });
});



document.getElementById('byttpb').addEventListener('click', function() {
    document.getElementById('byttprofilbilde').style.display = 'block';
    document.getElementById('byttpb').style.display = 'none';

    document.querySelector('#byttprofilbilde').addEventListener('submit', function(event) {
            event.preventDefault();
            const picture = document.querySelector('input[name="picture"]').files[0];
            const submitButton = document.getElementById('submitButton');

            let imageURL = '';
            if(picture) {
                const storageRef = storage.ref('profilbilder/' + picture.name);
                storageRef.put(picture)
                    .then((snapshot) => {
                        console.log('File uploaded successfully');
                        return snapshot.ref.getDownloadURL(); // Get URL of uploaded file
                    })
                    .then((downloadURL) => {
                        const user = firebase.auth().currentUser;
                        if (user) {
                        return db.collection('brukere').doc(user.uid).update({
                            profilbilde: downloadURL
                        });
                        } else {
                            console.log('User is not logged in');
                        }
                    })
                .then(() => {
                    console.log('Document updated successfully');
                    document.getElementById('byttprofilbilde').style.display = 'none';
                    document.getElementById('byttpb').style.display = 'block';
                    alert("Profilbildet er oppdatert!")
                    window.location.href = "brukerside";
                })
                .catch((error) => {
                    console.error("Error updating document: ", error);
                });
        }
    });
});


    
    function stempleInnManuelt() {
        // const iceStafett = document.querySelector('.ice-stafett');
        // iceStafett.classList.toggle('hidden');
        
        const stempling = document.querySelector('.stemple-inn');
        stempling.classList.toggle('hidden');
        document.querySelector('#stempling-inn').addEventListener('submit', function(event) {
            event.preventDefault();
            const user = firebase.auth().currentUser;
            if (user) {
                const userID = user.uid;
                const sted = document.querySelector('input[name="sted"]').value;
                const tid = firebase.firestore.Timestamp.now();
                const metode = 'manual';
                db.collection('Innlogginger').add({
                    userID,
                    tid,
                    metode,
                    sted,
                    status: true
                })
                .then(() => {
                    console.log('Document updated successfully');
                    stempling.classList.toggle('hidden');
                    window.location.href = "brukerside";
                })
        .catch((error) => {
            console.error("Error updating document: ", error);
        });
        } else {
            console.log('User is not logged in');
        }
    });
}
function stempleUtManuelt () {
    const user = firebase.auth().currentUser;
    if (user) {
        const userID = user.uid;
        const tid = firebase.firestore.Timestamp.now();
        const metode = 'manual';
        db.collection('Innlogginger').add({
            userID,
            tid,
            metode,
            status: false
        })
        .then(() => {
            console.log('Document updated successfully');
            alert("Du er stemplet ut!")
            window.location.href = "brukerside";
        })
        .catch((error) => {
            console.error("Error updating document: ", error);
        });
    } else { console.log('User is not logged in'); }
}






function loggut() {
    firebase.auth().signOut().then(() => {
        console.log('User signed out successfully');
        window.location.href = "../";
    }).catch((error) => {
        console.error("Error signing out: ", error);
    });
}

