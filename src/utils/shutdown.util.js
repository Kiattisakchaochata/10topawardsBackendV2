
const shutdown = (signal, server) => {
  console.log(`Received ${signal}. Closing server...`)
  server.close(() => {
    console.log('Server closed. Exiting process.')
    process.exit(0)
  })
}

export default shutdown