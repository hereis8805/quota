// Web Worker: 백그라운드에서 안정적인 타이머 실행
let intervalId = null
let remaining = 0
let phase = 'work' // 'work' | 'rest'

self.onmessage = function (e) {
  const { type, payload } = e.data

  switch (type) {
    case 'START':
      remaining = payload.seconds
      phase = payload.phase
      clearInterval(intervalId)
      intervalId = setInterval(() => {
        remaining -= 1
        self.postMessage({ type: 'TICK', remaining, phase })
        if (remaining <= 0) {
          clearInterval(intervalId)
          self.postMessage({ type: 'DONE', phase })
        }
      }, 1000)
      break

    case 'PAUSE':
      clearInterval(intervalId)
      self.postMessage({ type: 'PAUSED', remaining, phase })
      break

    case 'RESUME':
      clearInterval(intervalId)
      intervalId = setInterval(() => {
        remaining -= 1
        self.postMessage({ type: 'TICK', remaining, phase })
        if (remaining <= 0) {
          clearInterval(intervalId)
          self.postMessage({ type: 'DONE', phase })
        }
      }, 1000)
      break

    case 'RESET':
      clearInterval(intervalId)
      remaining = payload?.seconds ?? 0
      phase = payload?.phase ?? 'work'
      self.postMessage({ type: 'RESET_OK', remaining, phase })
      break

    case 'STOP':
      clearInterval(intervalId)
      break
  }
}
