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

workboxSW.precache([])

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
