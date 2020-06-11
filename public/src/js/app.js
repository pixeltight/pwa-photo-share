/* eslint-disable */
let deferredPrompt = null
const enableNotificationsButtons = document.querySelectorAll('.enable-notifications')

if (!window.Promise) {
  window.Promise = Promise
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/service-worker.js', { scope: '/' })
    .then(() => {
      console.log('Service worker registered!')
    })
    .catch(err => {
      console.log('[SERVICE WORKER] Event Registration error: ', err)
    })
}

window.addEventListener('beforeinstallprompt', (event) => {
  console.log('beforeinstallprompt fired')
  event.preventDefault()
  deferredPrompt = event
  return false
})

const displayConfirmNotification = () => {
  if ('serviceWorker' in navigator) {
    let options = {
      body: 'You successfully subscribed to our notification service!',
      icon: '/src/images/icons/app-icon-96x96.png',
      dir: 'ltr',
      lang: 'en-US', // BCP 47
      vibrate: [100, 50, 200],
      badge: '/src/images/icons/app-icon-96x96.png',
      tag: 'confirm-notification',
      renotify: true,
      actions: [
        { action: 'confirm', title: 'Okay', icon: '/src/images/icons/app-icon-96x96.png' },
        { action: 'confirm', title: 'Cancel', icon: '/src/images/icons/app-icon-96x96.png' }
      ]
    }

    navigator.serviceWorker.ready
      // serviceWorker Registration
      .then(swreg => {
        swreg.showNotification('Sucessfully subscribed (from SW)!', options)
      })
  }
}

const configurePushSub = () => {
  if (!('serviceWorker' in navigator)) {
    return
  }

  let reg
  navigator.serviceWorker.ready
    .then(swreg => {
      reg = swreg
      return swreg.pushManager.getSubscription()
    })
    .then(sub => {
      if (sub === null) {
        // create new subscription
        // must secure the subscription endpoint
        const vapidPublicKey = 'BEtJhcxi7UZqEjomaCxkhx9Gan02YmazKB-aKGj4iXA_GWilM-hbLYopldTYxHJN-K2qMnPezXQuGC1XjcLFlIk'
        const convertedVapidPublicKey = urlBase64ToUint8Array(vapidPublicKey)
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidPublicKey
        })
      } else {
        // use existing subscription
      }
    })
    .then(newSub => {
      console.log('78', newSub)
      return fetch('https://pwa-max-6421b.firebaseio.com/subscriptions.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(newSub)
      })
    })
    .then(res => {
      if (res.ok) {
        displayConfirmNotification()
      }
    })
    .catch(err => {
      console.log(err)
    })
}

const askForNotificationPermission = () => {
  Notification.requestPermission(result => {
    console.log('%cUser Choice: ' + result, 'background: green; color: #FFF; font-size: 14px')
    if (result !== 'granted') {
      console.log('%cNo notification permission granted', 'background: purple; color: #FFF; font-size: 14px')
    } else {
      // displayConfirmNotification()
      configurePushSub()
    }
  })
}

if ('Notification' in window && 'serviceWorker' in navigator) {
  for (let button of enableNotificationsButtons) {
    button.style.display = 'inline-block'
    button.addEventListener('click', askForNotificationPermission)
  }
}
