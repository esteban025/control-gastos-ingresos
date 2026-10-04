import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { buscar } from './buscar.ts'
import { createCategoria, deleteCategoria, listCategorias, updateCategoria } from './categorias.ts'
import { createCuenta, deleteCuenta, listCuentas, parseCuenta, updateCuenta } from './cuentas.ts'
import { getDashboard } from './dashboard.ts'
import { pool } from './db.ts'
import { createDeuda, deleteDeuda, listDeudas, updateDeuda } from './deudas.ts'
import { createInversion, deleteInversion, listInversiones, updateInversion } from './inversiones.ts'
import { createMeta, deleteMeta, listMetas, updateMeta } from './metas.ts'
import { createMovimiento, databaseErrorMessage, deleteMovimiento, getCatalogos, parseMovimiento, updateMovimiento } from './movimientos.ts'
import { getPerfil, updatePerfil } from './perfil.ts'
import { isPeriodo, type Periodo } from './period.ts'
import { createPresupuesto, deletePresupuesto, listPresupuestos, updatePresupuesto } from './presupuestos.ts'
import { getReportes } from './reportes.ts'
import { listTransacciones } from './transacciones.ts'

const port = Number(process.env.API_PORT ?? 3001)

function periodoFrom(url: URL): Periodo | null {
  const periodo = url.searchParams.get('periodo') ?? 'mes'
  return isPeriodo(periodo) ? periodo : null
}

function resourceId(pathname: string, resource: string): number | null {
  const match = new RegExp(`^/api/${resource}/(\\d+)$`).exec(pathname)
  if (!match) return null
  const id = Number(match[1])
  return Number.isInteger(id) && id > 0 ? id : null
}

async function write(res: ServerResponse, status: number, action: () => Promise<unknown>) {
  try {
    const result = await action()
    send(res, status, result === undefined ? { ok: true } : result)
  } catch (error) {
    if (error instanceof SyntaxError) {
      send(res, 400, { error: 'El JSON no es válido' })
      return
    }
    send(res, 400, { error: databaseErrorMessage(error) })
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  })
  res.end(json)
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1_000_000) throw new Error('El cuerpo de la petición es demasiado grande')
    chunks.push(buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw) as unknown
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')

  try {
    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const periodo = url.searchParams.get('periodo') ?? 'mes'
      if (!isPeriodo(periodo)) {
        send(res, 400, { error: 'Periodo no válido' })
        return
      }
      send(res, 200, await getDashboard(periodo))
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/catalogos') {
      send(res, 200, await getCatalogos())
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/cuentas') {
      send(res, 200, await listCuentas())
      return
    }

    const cuentaMatch = /^\/api\/cuentas\/(\d+)$/.exec(url.pathname)
    const cuentaId = cuentaMatch ? Number(cuentaMatch[1]) : null

    if (cuentaId && (req.method === 'PUT' || req.method === 'DELETE')) {
      try {
        if (req.method === 'DELETE') {
          await deleteCuenta(cuentaId)
          send(res, 200, { ok: true })
          return
        }
        const input = parseCuenta(await readBody(req))
        await updateCuenta(cuentaId, input)
        send(res, 200, { id: cuentaId })
        return
      } catch (error) {
        if (error instanceof SyntaxError) {
          send(res, 400, { error: 'El JSON no es válido' })
          return
        }
        send(res, 400, { error: databaseErrorMessage(error) })
        return
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/cuentas') {
      try {
        const input = parseCuenta(await readBody(req))
        send(res, 201, await createCuenta(input))
      } catch (error) {
        if (error instanceof SyntaxError) {
          send(res, 400, { error: 'El JSON no es válido' })
          return
        }
        send(res, 400, { error: databaseErrorMessage(error) })
      }
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/transacciones') {
      const periodo = periodoFrom(url)
      if (!periodo) {
        send(res, 400, { error: 'Periodo no válido' })
        return
      }
      send(res, 200, await listTransacciones(periodo, url.searchParams.get('q') ?? ''))
      return
    }

    const movimientoId = resourceId(url.pathname, 'movimientos')
    if (movimientoId && (req.method === 'PUT' || req.method === 'DELETE')) {
      await write(res, 200, async () => {
        if (req.method === 'DELETE') {
          await deleteMovimiento(movimientoId)
          return
        }
        await updateMovimiento(movimientoId, parseMovimiento(await readBody(req)))
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/movimientos') {
      await write(res, 201, async () => createMovimiento(parseMovimiento(await readBody(req))))
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/presupuestos') {
      const periodo = periodoFrom(url)
      if (!periodo) {
        send(res, 400, { error: 'Periodo no válido' })
        return
      }
      send(res, 200, await listPresupuestos(periodo))
      return
    }

    const presupuestoId = resourceId(url.pathname, 'presupuestos')
    if (presupuestoId && (req.method === 'PUT' || req.method === 'DELETE')) {
      await write(res, 200, async () => {
        if (req.method === 'DELETE') {
          await deletePresupuesto(presupuestoId)
          return
        }
        await updatePresupuesto(presupuestoId, await readBody(req))
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/presupuestos') {
      const periodo = periodoFrom(url)
      if (!periodo) {
        send(res, 400, { error: 'Periodo no válido' })
        return
      }
      await write(res, 201, async () => createPresupuesto(periodo, await readBody(req)))
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/metas') {
      send(res, 200, await listMetas())
      return
    }

    const metaId = resourceId(url.pathname, 'metas')
    if (metaId && (req.method === 'PUT' || req.method === 'DELETE')) {
      await write(res, 200, async () => {
        if (req.method === 'DELETE') {
          await deleteMeta(metaId)
          return
        }
        await updateMeta(metaId, await readBody(req))
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/metas') {
      await write(res, 201, async () => createMeta(await readBody(req)))
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/deudas') {
      send(res, 200, await listDeudas())
      return
    }

    const deudaId = resourceId(url.pathname, 'deudas')
    if (deudaId && (req.method === 'PUT' || req.method === 'DELETE')) {
      await write(res, 200, async () => {
        if (req.method === 'DELETE') {
          await deleteDeuda(deudaId)
          return
        }
        await updateDeuda(deudaId, await readBody(req))
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/deudas') {
      await write(res, 201, async () => createDeuda(await readBody(req)))
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/inversiones') {
      send(res, 200, await listInversiones())
      return
    }

    const inversionId = resourceId(url.pathname, 'inversiones')
    if (inversionId && (req.method === 'PUT' || req.method === 'DELETE')) {
      await write(res, 200, async () => {
        if (req.method === 'DELETE') {
          await deleteInversion(inversionId)
          return
        }
        await updateInversion(inversionId, await readBody(req))
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/inversiones') {
      await write(res, 201, async () => createInversion(await readBody(req)))
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/categorias') {
      const periodo = periodoFrom(url)
      if (!periodo) {
        send(res, 400, { error: 'Periodo no válido' })
        return
      }
      send(res, 200, await listCategorias(periodo))
      return
    }

    const categoriaId = resourceId(url.pathname, 'categorias')
    if (categoriaId && (req.method === 'PUT' || req.method === 'DELETE')) {
      await write(res, 200, async () => {
        if (req.method === 'DELETE') {
          await deleteCategoria(categoriaId)
          return
        }
        await updateCategoria(categoriaId, await readBody(req))
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/categorias') {
      await write(res, 201, async () => createCategoria(await readBody(req)))
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/reportes') {
      const periodo = periodoFrom(url)
      if (!periodo) {
        send(res, 400, { error: 'Periodo no válido' })
        return
      }
      send(res, 200, await getReportes(periodo))
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/perfil') {
      send(res, 200, await getPerfil())
      return
    }

    if (req.method === 'PUT' && url.pathname === '/api/perfil') {
      await write(res, 200, async () => updatePerfil(await readBody(req)))
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/buscar') {
      send(res, 200, await buscar(url.searchParams.get('q') ?? ''))
      return
    }

    send(res, 404, { error: 'No encontrado' })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'Error al consultar la base de datos'
    send(res, 500, { error: message })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`API en http://127.0.0.1:${port}`)
})

async function shutdown() {
  server.close()
  await pool.end()
  process.exit(0)
}

process.on('SIGINT', () => {
  void shutdown()
})
process.on('SIGTERM', () => {
  void shutdown()
})
