/* eslint-disable */
importScripts('workbox-sw.prod.v2.1.3.js')
importScripts('/src/js/idb.js')
importScripts('/src/js/utility.js')

const workboxSW = new self.WorkboxSW()

workboxSW.router.registerRoute(
  /.*(?:googleapis|gstatic)\.com.*$/,
  workboxSW.strategies.staleWhileRevalidate({
    cacheName: 'google-fonts',
    cacheExpiration: {
      maxEntries: 10,
      maxAgeSeconds: 60 * 60 * 24 * 30
    }
  })
)

workboxSW.router.registerRoute(
  'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.blue_grey-red.min.css',
  workboxSW.strategies.staleWhileRevalidate({
    cacheName: 'material-css'
  })
)

workboxSW.router.registerRoute(
  'https://pwa-max-6421b.firebaseio.com/posts.json',
  args => {
    return fetch(args.event.request)
      .then(response => {
        let clonedRes = response.clone()
        clearAllData('posts')
          .then(() => {
            return clonedRes.json()
          })
          .then(data => {
            for (let key in data) {
              writeData('posts', data[key])
            }
          })
        return response
      })
  }
)

workboxSW.router.registerRoute(routeData => {
  return (routeData.event.request.headers.get('accept').includes('text/html'))
}, args => {
  return caches.match(args.event.request)
    .then(response => {
      if (response) {
        return response
      } else {
        return fetch(args.event.request)
          .then(res => {
            return caches.open('dynamic')
              .then(cache => {
                cache.put(args.event.request.url, res.clone())
                return res
              })
          })
          .catch(err => {
            console.log('Cached resources not loaded: ', err)
            return caches.match('/offline.html')
              .then(res => {
                return res
              })
          })
      }
    })
})

workboxSW.precache([
  {
    "url": "favicon.ico",
    "revision": "2cab47d9e04d664d93c8d91aec59e812"
  },
  {
    "url": "index.html",
    "revision": "0666af8d9483c9aed53b6ef218da7a5a"
  },
  {
    "url": "manifest.json",
    "revision": "8b3eaa44cef1aeb37d271822fa32b201"
  },
  {
    "url": "offline.html",
    "revision": "54d25441a8d9351a52da51cff1dfecfa"
  },
  {
    "url": "src/css/app.css",
    "revision": "2fd3649a72a97f23ac924a120c5487c7"
  },
  {
    "url": "src/css/feed.css",
    "revision": "4b3731dccf6d66dc79bc009a419686d4"
  },
  {
    "url": "src/css/help.css",
    "revision": "1c6d81b27c9d423bece9869b07a7bd73"
  },
  {
    "url": "src/images/main-image2-lg.jpg",
    "revision": "48b45a26559cc6675057019e986099d3"
  },
  {
    "url": "src/images/main-image2-sm.jpg",
    "revision": "d1c34a6746a9d99427f650fab28ac4f2"
  },
  {
    "url": "src/images/main-image2.jpg",
    "revision": "8751a9372e202545581df5816de1b70e"
  },
  {
    "url": "src/js/app.min.js",
    "revision": "6b3f2ad2b49caab289aa7b666ce7c061"
  },
  {
    "url": "src/js/feed.min.js",
    "revision": "76b2724ff5e50db150a4e132284b2922"
  },
  {
    "url": "src/js/fetch.min.js",
    "revision": "32590119a06bf9ade8026dd12baa695e"
  },
  {
    "url": "src/js/idb.min.js",
    "revision": "ea82c8cec7e6574ed535bee7878216e0"
  },
  {
    "url": "src/js/material.min.js",
    "revision": "713af0c6ce93dbbce2f00bf0a98d0541"
  },
  {
    "url": "src/js/promise.min.js",
    "revision": "7be19d2e97926f498f2668e055e26b22"
  },
  {
    "url": "src/js/utility.min.js",
    "revision": "d2e113ea7a71f6a9f579087ecc6dd625"
  }
])

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
            console.log('client is not undefined')
            client.navigate(notification.data.url)
            client.focus()
          } else {
            console.log('client is defined')
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
