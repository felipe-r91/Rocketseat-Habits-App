import Fastify from 'fastify'
import cors from '@fastify/cors'
import { appRoutes } from './lib/routes'
//Create an application
const app = Fastify()

app.register(cors)
app.register(appRoutes)

// Configure an port for server
app.listen({
    port: 3333,
    host: '0.0.0.0',
}).then (() => {
console.log('HTTP server running')
})