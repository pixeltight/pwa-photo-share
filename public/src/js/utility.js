// open indexedDb, create new object store

const dbPromise = idb.open('posts-store', 1, (db) => {
  if (!db.objectStoreNames.contains('posts')) {
    db.createObjectStore('posts', {
      keyPath: 'id'
    })
  }
  if (!db.objectStoreNames.contains('sync-posts')) {
    db.createObjectStore('sync-posts', {
      keyPath: 'id'
    })
  }
})

const writeData = (st, data) => {
  return dbPromise
    .then(db => {
      let transaction = db.transaction(st, 'readwrite')
      let store = transaction.objectStore(st)
      store.put(data)
      return transaction.complete
    })
}

const readAllData = st => {
  return dbPromise
    .then(db => {
      let transaction = db.transaction(st, 'readonly')
      let store = transaction.objectStore(st)
      return store.getAll()
    })
}

const clearAllData = st => {
  console.log('CLEARING DATA')
  return dbPromise
    .then(db => {
      let transaction = db.transaction(st, 'readwrite')
      let store = transaction.objectStore(st)
      store.clear()
      return transaction.complete
    })
}

const deleteItemFromData = (st, id) => {
  return dbPromise
    .then(db => {
      let tx = db.transaction(st, 'readwrite')
      let store = tx.objectStore(st)
      store.delete(id)
      return tx.complete
    })
    .then(() => {
      console.log('%c deleting ' + id + ' %cfrom database', 'color: green')
    })
}

function urlBase64ToUint8Array (base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4)
  var base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  var rawData = window.atob(base64)
  var outputArray = new Uint8Array(rawData.length)

  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// prepare canvas image for upload
const dataURItoBlob = (dataURI) => {
  var byteString = atob(dataURI.split(',')[1])
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
  var ab = new ArrayBuffer(byteString.length)
  var ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  var blob = new Blob([ab], { type: mimeString })
  return blob
}
