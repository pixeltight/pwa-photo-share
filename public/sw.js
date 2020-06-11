/* eslint-env serviceworker */

importScripts('/src/js/idb.js')
importScripts('/src/js/utility.js')

const CACHE_STATIC_NAME = 'static-v9'
const CACHE_DYNAMIC_NAME = 'dynamic-v4'
const STATIC_FILES = [
  '/',
  '/index.html',
  '/offline.html',
  '/src/js/app.js',
  '/src/js/utility.js',
  '/src/js/promise.js',
  '/src/js/fetch.js',
  '/src/js/feed.js',
  '/src/js/idb.js',
  '/src/js/material.min.js',
  '/src/css/app.css',
  '/src/css/feed.css',
  '/src/images/main-image.jpg',
  'https://fonts.googleapis.com/css?family=Roboto:400,700',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'
]

// const trimCache = (cacheName, maxItems) => {
//   caches.open(cacheName)
//     .then(cache => {
//       return cache.keys()
//         .then(keys => {
//           if (keys.length > maxItems) {
//             cache.delete(keys[0])
//               .then(trimCache(cacheName, maxItems))
//           }
//         })
//     })
// }

const isInArray = (string, arr) => {
  let cachedPath
  if (string.indexOf(self.origin) === 0) {
    console.log('matched: ' + string)
    cachedPath = string.substring(self.origin.length)
  } else {
    cachedPath = string
  }
  return arr.indexOf(cachedPath) > -1
}

self.addEventListener('install', (event) => {
  console.info('[SERVICE WORKER] Installing Service Worker ... ', event)
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME)
      .then((cache) => {
        console.info('[SERVICE WORKER] Precaching static files', event)
        cache.addAll(STATIC_FILES)
      })
      .catch(err => {
        console.warn('Error: ', err)
      })
  )
})

self.addEventListener('activate', (event) => {
  console.info('[SERVICE WORKER] Activating Service Worker ... ', event)

  event.waitUntil(
    caches.keys()
      .then(keyList => {
        return Promise.all(keyList.map(key => {
          if (key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME) {
            console.warn('[SERVICE WORKER] removing old cache: ', key)
            return caches.delete(key)
          }
        }))
      })
  )
  return self.clients.claim()
})

// good for refreshed content to hit screen quickly
// bad offline?
self.addEventListener('fetch', (event) => {
  // CACHE THEN NETWORK
  const url = 'https://pwa-max-6421b.firebaseio.com/posts'

  if (event.request.url.indexOf(url) > -1) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          let clonedRes = response.clone()
          clearAllData('posts')
            .then(() => {
              return clonedRes.json()
            })
            .then(data => {
              for (let key in data) {
                writeData('posts', data[key])
                // .then(() => {
                //   deleteItemFromData('posts', key)
                // })
              }
            })
          return response
        })
    )
  } else if (isInArray(event.request.url, STATIC_FILES)) {
    event.respondWith(
      caches.match(event.request)
    )
  } else {
    event.respondWith(
      // CACHE WITH NETWORK FALLBACK
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response
          } else {
            return fetch(event.request)
              .then((res) => {
                return caches.open(CACHE_DYNAMIC_NAME)
                  .then(cache => {
                    // trimCache(CACHE_DYNAMIC_NAME, 20)
                    cache.put(event.request.url, res.clone())
                    return res
                  })
              })
          }
        })
        .catch(err => {
          console.log('Cached resources not loaded: ', err)
          return caches.open(CACHE_STATIC_NAME)
            .then(cache => {
              if (event.request.headers.get('accept').includes('text/html')) {
                return cache.match('/offline.html')
              }
            })
        })
    )
  }
})

self.addEventListener('sync', (event) => {
  console.log('[SERVICE WORKER] background syncing', event)
  if (event.tag === 'sync-new-posts') {
    console.log('%c[SERVICE WORKER] Syncing new posts:', 'background: green; color: #FFF')
    event.waitUntil(
      readAllData('sync-posts')
        .then(data => {
          for (let dt of data) {
            let postData = new FormData()
            postData.append('id', dt.id)
            postData.append('title', dt.title)
            postData.append('location', dt.location)
            postData.append('rawLocationLat', dt.rawLocation.lat)
            postData.append('rawLocationLng', dt.rawLocation.lng)
            postData.append('file', dt.picture, dt.id + '.png')
            fetch('https://us-central1-pwa-max-6421b.cloudfunctions.net/storePostData', {
              method: 'POST',
              body: postData
            })
              .then(res => {
                console.log('165 Sent data', res)
                if (res.ok) {
                  res.json()
                    .then(resData => {
                      deleteItemFromData('sync-posts', resData.id)
                    })
                }
              })
              .catch(err => {
                console.log('174', err)
              })
          }
        })
    )
  }
})

self.addEventListener('notificationclick', event => {
  let notification = event.notification
  let action = event.action

  console.log('NOTIFICATION', event)

  if (action === 'confirm') {
    console.log('Confirm was chosen')
    notification.close()
  } else {
    console.log(action)
    event.waitUntil(
      clients.matchAll()
        .then(clis => {
          let client = clis.find(c => {
            return c.visibilityState === 'visible'
          })
          if (client !== undefined) {
            client.navigate(notification.data.url)
            client.focus()
          } else {
            clients.openWindow(notification.data.url)
          }
          notification.close()
        })
    )
  }
})

self.addEventListener('notificationclose', event => {
  console.log('NOTIFIATION CLOSED: ', event)
})

self.addEventListener('push', event => {
  console.log('Push Notification received!', event)
  let data = {
    title: 'New!',
    content: 'Something new happened!',
    openUrl: '/'
  }
  if (event.data) {
    data = JSON.parse(event.data.text())
  }

  const options = {
    body: data.content,
    icon: '/src/images/icons/app-icon-96x96.png',
    badge: '/src/images/icons/app-icon-96x96.png',
    data: {
      url: data.openUrl
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})
