-- Control (gastos e ingresos)
-- MySQL 8.0.16 o superior · pensado para ejecutarse completo en MySQL Workbench
--
-- Cómo correrlo:
--   1. Ábrelo en Workbench.
--   2. Ejecuta el script entero (el rayo de "Execute" / Ctrl+Shift+Enter).
--      No uses "ejecutar la sentencia actual": DELIMITER tiene que correr junto
--      con los triggers y los procedimientos.
--   3. Si ya creaste el esquema vacío y lo tienes seleccionado, borra o comenta
--      las dos líneas de CREATE DATABASE y USE, o cambia el nombre.
--
-- Volver a ejecutarlo borra las tablas de esa base y las crea de nuevo.
--
-- Los números de la app (saldo de cuenta, gastado del presupuesto, ahorrado de
-- una meta, saldo de una deuda, totales del dashboard) no se guardan: salen de
-- vistas y procedimientos sobre movimientos + saldos iniciales.
--
-- Supuestos:
--   * Una sola persona (tabla perfil, una fila). Sin login ni multi-usuario.
--   * Moneda única: los montos son DECIMAL en la moneda de perfil.
--   * "Modo" es el método de pago (efectivo, transferencia, tarjeta...), un
--     catálogo aparte de la cuenta y del tipo.
--   * La categoría pertenece a un tipo. Un movimiento de "gasto" solo puede
--     usar categorías de gasto, y lo mismo para ingreso, pago de deuda, etc.
--   * Transferencia mueve saldo entre dos cuentas y no entra en ingresos/gastos
--     del periodo.

CREATE DATABASE IF NOT EXISTS control_gastos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE control_gastos;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS v_movimientos;
DROP VIEW IF EXISTS v_deudas;
DROP VIEW IF EXISTS v_metas;
DROP VIEW IF EXISTS v_presupuestos;
DROP VIEW IF EXISTS v_cuentas;

DROP TABLE IF EXISTS inversion_historico;
DROP TABLE IF EXISTS inversiones;
DROP TABLE IF EXISTS presupuestos;
DROP TABLE IF EXISTS movimientos;
DROP TABLE IF EXISTS metas;
DROP TABLE IF EXISTS deudas;
DROP TABLE IF EXISTS cuentas;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS tipos_inversion;
DROP TABLE IF EXISTS tipos_cuenta;
DROP TABLE IF EXISTS modos;
DROP TABLE IF EXISTS tipos_movimiento;
DROP TABLE IF EXISTS perfil;

DROP PROCEDURE IF EXISTS sp_validar_movimiento;
DROP PROCEDURE IF EXISTS sp_validar_presupuesto;
DROP PROCEDURE IF EXISTS sp_resumen_periodo;
DROP PROCEDURE IF EXISTS sp_totales_categoria;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Perfil y preferencias (una sola fila)
-- dia_inicio_mes: el periodo "este mes" arranca ese día (la UI ofrece 1 o 15).
-- ---------------------------------------------------------------------------

CREATE TABLE perfil (
  id                  SMALLINT NOT NULL DEFAULT 1 PRIMARY KEY,
  nombre              VARCHAR(120) NOT NULL,
  correo              VARCHAR(180) NOT NULL,
  moneda              CHAR(3) NOT NULL DEFAULT 'USD',
  dia_inicio_mes      SMALLINT NOT NULL DEFAULT 1,
  aviso_cuotas        BOOLEAN NOT NULL DEFAULT TRUE,
  aviso_presupuesto   BOOLEAN NOT NULL DEFAULT TRUE,
  resumen_semanal     BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_perfil_unica_fila CHECK (id = 1),
  CONSTRAINT chk_perfil_moneda CHECK (moneda REGEXP '^[A-Z]{3}$'),
  CONSTRAINT chk_perfil_dia CHECK (dia_inicio_mes BETWEEN 1 AND 28)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Perfil y preferencias. No guarda cifras financieras.';

-- ---------------------------------------------------------------------------
-- Catálogos
-- efecto de un tipo de movimiento sobre el saldo de la cuenta:
--   suma      ingresa dinero (cuenta como ingreso del periodo si cuenta_en_periodo)
--   resta     sale dinero (cuenta como gasto del periodo si cuenta_en_periodo)
--   traslado  mueve entre cuenta_id y cuenta_destino_id; no es ingreso ni gasto
--   ninguno   no toca saldos
-- ---------------------------------------------------------------------------

CREATE TABLE tipos_movimiento (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  codigo              VARCHAR(40) NOT NULL,
  nombre              VARCHAR(80) NOT NULL,
  efecto              VARCHAR(20) NOT NULL,
  cuenta_en_periodo   BOOLEAN NOT NULL DEFAULT TRUE,
  es_sistema          BOOLEAN NOT NULL DEFAULT FALSE,
  archivado           BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tipos_movimiento_codigo (codigo),
  UNIQUE KEY uq_tipos_movimiento_nombre (nombre),
  CONSTRAINT chk_tipos_codigo CHECK (codigo REGEXP '^[a-z0-9_]+$'),
  CONSTRAINT chk_tipos_efecto CHECK (efecto IN ('suma', 'resta', 'traslado', 'ninguno'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tipos editables. El codigo y el efecto de los tipos de sistema no se cambian.';

CREATE TABLE modos (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre              VARCHAR(80) NOT NULL,
  archivado           BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_modos_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Metodo de pago: efectivo, transferencia, tarjeta. No es la cuenta bancaria.';

CREATE TABLE tipos_cuenta (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre              VARCHAR(80) NOT NULL,
  archivado           BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tipos_cuenta_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Clase de cuenta: efectivo, banco, cooperativa, tarjeta.';

CREATE TABLE tipos_inversion (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre              VARCHAR(80) NOT NULL,
  archivado           BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tipos_inversion_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Categorías (cada una pertenece a un solo tipo)
-- ---------------------------------------------------------------------------

CREATE TABLE categorias (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tipo_id             BIGINT NOT NULL,
  nombre              VARCHAR(80) NOT NULL,
  archivado           BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categorias_tipo_nombre (tipo_id, nombre),
  CONSTRAINT fk_categorias_tipo FOREIGN KEY (tipo_id) REFERENCES tipos_movimiento (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Los movimientos guardan categoria_id. Archivar en lugar de borrar si ya hay historial.';

-- ---------------------------------------------------------------------------
-- Cuentas. El saldo visible está en v_cuentas, no en esta tabla.
-- ---------------------------------------------------------------------------

CREATE TABLE cuentas (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tipo_cuenta_id      BIGINT NOT NULL,
  nombre              VARCHAR(120) NOT NULL,
  institucion         VARCHAR(150) NULL COMMENT 'Banco o cooperativa. NULL si es efectivo.',
  saldo_inicial       DECIMAL(14, 2) NOT NULL DEFAULT 0 COMMENT 'Saldo el dia en que empiezas a registrar la cuenta.',
  fecha_saldo_inicial DATE NOT NULL DEFAULT (CURRENT_DATE),
  archivado           BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_cuentas_tipo (tipo_cuenta_id),
  CONSTRAINT fk_cuentas_tipo FOREIGN KEY (tipo_cuenta_id) REFERENCES tipos_cuenta (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Efectivo, bancos, cooperativas o tarjetas.';

-- ---------------------------------------------------------------------------
-- Metas y deudas. El progreso se calcula; aquí va el dato de partida.
-- ---------------------------------------------------------------------------

CREATE TABLE metas (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre              VARCHAR(120) NOT NULL,
  objetivo            DECIMAL(14, 2) NOT NULL,
  fecha_objetivo      DATE NULL,
  cuenta_id           BIGINT NULL COMMENT 'Cuenta de destino, opcional.',
  ahorrado_inicial    DECIMAL(14, 2) NOT NULL DEFAULT 0,
  archivado           BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_metas_objetivo CHECK (objetivo > 0),
  CONSTRAINT chk_metas_ahorrado CHECK (ahorrado_inicial >= 0),
  CONSTRAINT fk_metas_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ahorrado = ahorrado_inicial + movimientos con meta_id.';

CREATE TABLE deudas (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre              VARCHAR(120) NOT NULL,
  acreedor            VARCHAR(150) NULL,
  saldo_inicial       DECIMAL(14, 2) NOT NULL,
  cuota               DECIMAL(14, 2) NOT NULL,
  proxima_fecha       DATE NULL,
  archivado           BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_deudas_saldo CHECK (saldo_inicial >= 0),
  CONSTRAINT chk_deudas_cuota CHECK (cuota >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='saldo = saldo_inicial menos pagos. El estado se calcula en v_deudas. Sin intereses.';

-- ---------------------------------------------------------------------------
-- Movimientos: el registro del que sale casi toda la app
-- ---------------------------------------------------------------------------

CREATE TABLE movimientos (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tipo_id             BIGINT NOT NULL,
  categoria_id        BIGINT NULL,
  modo_id             BIGINT NULL,
  cuenta_id           BIGINT NOT NULL,
  cuenta_destino_id   BIGINT NULL COMMENT 'Solo transferencias: cuenta que recibe el monto.',
  meta_id             BIGINT NULL COMMENT 'Si viene informado, el monto suma al ahorrado de esa meta.',
  deuda_id            BIGINT NULL COMMENT 'En un gasto o pago de deuda, el monto resta al saldo de esa deuda.',
  fecha               DATE NOT NULL,
  monto               DECIMAL(14, 2) NOT NULL,
  descripcion         VARCHAR(500) NOT NULL DEFAULT '',
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_movimientos_fecha (fecha),
  CONSTRAINT chk_movimientos_monto CHECK (monto > 0),
  CONSTRAINT chk_movimientos_cuentas CHECK (cuenta_destino_id IS NULL OR cuenta_destino_id <> cuenta_id),
  CONSTRAINT fk_mov_tipo FOREIGN KEY (tipo_id) REFERENCES tipos_movimiento (id),
  CONSTRAINT fk_mov_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id),
  CONSTRAINT fk_mov_modo FOREIGN KEY (modo_id) REFERENCES modos (id),
  CONSTRAINT fk_mov_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas (id),
  CONSTRAINT fk_mov_cuenta_destino FOREIGN KEY (cuenta_destino_id) REFERENCES cuentas (id),
  CONSTRAINT fk_mov_meta FOREIGN KEY (meta_id) REFERENCES metas (id),
  CONSTRAINT fk_mov_deuda FOREIGN KEY (deuda_id) REFERENCES deudas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ingreso, gasto, pago de deuda o transferencia. El resto de pantallas lee esta tabla.';

-- ---------------------------------------------------------------------------
-- Presupuestos: solo el tope. Lo gastado se suma en v_presupuestos.
-- El mes respeta perfil.dia_inicio_mes: si es 15, septiembre va del 15 sep al 14 oct.
-- ---------------------------------------------------------------------------

CREATE TABLE presupuestos (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  categoria_id        BIGINT NOT NULL,
  anio                SMALLINT NOT NULL,
  mes                 SMALLINT NOT NULL,
  tope                DECIMAL(14, 2) NOT NULL,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_presupuestos_periodo (categoria_id, anio, mes),
  KEY idx_presupuestos_periodo (anio, mes),
  CONSTRAINT chk_presupuestos_anio CHECK (anio BETWEEN 2000 AND 2100),
  CONSTRAINT chk_presupuestos_mes CHECK (mes BETWEEN 1 AND 12),
  CONSTRAINT chk_presupuestos_tope CHECK (tope >= 0),
  CONSTRAINT fk_presupuestos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Inversiones: el usuario carga el valor. No hay precio de mercado.
-- ---------------------------------------------------------------------------

CREATE TABLE inversiones (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tipo_inversion_id   BIGINT NOT NULL,
  nombre              VARCHAR(120) NOT NULL,
  valor_actual        DECIMAL(14, 2) NOT NULL,
  variacion_pct       DECIMAL(7, 2) NOT NULL DEFAULT 0 COMMENT 'Porcentaje que cargo el usuario, por ejemplo 4.20 o -0.80.',
  archivado           BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_inversiones_valor CHECK (valor_actual >= 0),
  CONSTRAINT fk_inversiones_tipo FOREIGN KEY (tipo_inversion_id) REFERENCES tipos_inversion (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='El dashboard solo suma valor_actual.';

CREATE TABLE inversion_historico (
  id                  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  inversion_id        BIGINT NOT NULL,
  fecha               DATE NOT NULL,
  valor               DECIMAL(14, 2) NOT NULL,
  variacion_pct       DECIMAL(7, 2) NOT NULL DEFAULT 0,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inversion_historico (inversion_id, fecha),
  CONSTRAINT chk_inversion_historico_valor CHECK (valor >= 0),
  CONSTRAINT fk_inversion_historico FOREIGN KEY (inversion_id) REFERENCES inversiones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Foto del valor cada vez que el usuario lo actualiza. La cifra vigente sigue en inversiones.';

-- ---------------------------------------------------------------------------
-- Reglas que cruzan tablas (MySQL no puede ponerlas en un CHECK)
-- ---------------------------------------------------------------------------

DELIMITER $$

CREATE PROCEDURE sp_validar_movimiento(
  IN p_es_insert TINYINT,
  IN p_tipo_id BIGINT,
  IN p_tipo_id_anterior BIGINT,
  IN p_categoria_id BIGINT,
  IN p_categoria_id_anterior BIGINT,
  IN p_modo_id BIGINT,
  IN p_modo_id_anterior BIGINT,
  IN p_cuenta_id BIGINT,
  IN p_cuenta_id_anterior BIGINT,
  IN p_cuenta_destino_id BIGINT,
  IN p_cuenta_destino_id_anterior BIGINT,
  IN p_meta_id BIGINT,
  IN p_deuda_id BIGINT
)
BEGIN
  DECLARE v_efecto VARCHAR(20) DEFAULT NULL;
  DECLARE v_codigo VARCHAR(40) DEFAULT NULL;
  DECLARE v_tipo_archivado TINYINT DEFAULT NULL;
  DECLARE v_tipo_categoria BIGINT DEFAULT NULL;
  DECLARE v_categoria_archivada TINYINT DEFAULT NULL;

  SELECT efecto, codigo, archivado
    INTO v_efecto, v_codigo, v_tipo_archivado
  FROM tipos_movimiento
  WHERE id = p_tipo_id;

  IF v_efecto IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tipo de movimiento inexistente';
  END IF;

  IF v_tipo_archivado = 1 AND (p_es_insert = 1 OR NOT (p_tipo_id <=> p_tipo_id_anterior)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El tipo de movimiento esta archivado';
  END IF;

  IF p_categoria_id IS NULL THEN
    IF v_efecto <> 'traslado' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La categoria es obligatoria para este tipo';
    END IF;
  ELSE
    SELECT tipo_id, archivado
      INTO v_tipo_categoria, v_categoria_archivada
    FROM categorias
    WHERE id = p_categoria_id;

    IF v_tipo_categoria IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Categoria inexistente';
    END IF;

    IF v_categoria_archivada = 1
       AND (p_es_insert = 1 OR NOT (p_categoria_id <=> p_categoria_id_anterior)) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La categoria esta archivada';
    END IF;

    IF v_tipo_categoria <> p_tipo_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La categoria no corresponde al tipo seleccionado';
    END IF;
  END IF;

  IF v_efecto = 'traslado' THEN
    IF p_cuenta_destino_id IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una transferencia necesita cuenta de destino';
    END IF;
  ELSEIF p_cuenta_destino_id IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo las transferencias usan cuenta de destino';
  END IF;

  IF p_deuda_id IS NOT NULL AND v_efecto <> 'resta' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo un gasto o un pago de deuda puede ligarse a una deuda';
  END IF;

  IF v_codigo = 'pago_deuda' AND p_deuda_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un pago de deuda debe indicar la deuda';
  END IF;

  IF p_meta_id IS NOT NULL AND v_efecto NOT IN ('resta', 'traslado') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un aporte a una meta debe ser un gasto o una transferencia';
  END IF;

  IF p_es_insert = 1 OR NOT (p_cuenta_id <=> p_cuenta_id_anterior) THEN
    IF (SELECT COUNT(*) FROM cuentas WHERE id = p_cuenta_id AND archivado = 0) = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de origen no existe o esta archivada';
    END IF;
  END IF;

  IF p_cuenta_destino_id IS NOT NULL
     AND (p_es_insert = 1 OR NOT (p_cuenta_destino_id <=> p_cuenta_destino_id_anterior)) THEN
    IF (SELECT COUNT(*) FROM cuentas WHERE id = p_cuenta_destino_id AND archivado = 0) = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta de destino no existe o esta archivada';
    END IF;
  END IF;

  IF p_modo_id IS NOT NULL
     AND (p_es_insert = 1 OR NOT (p_modo_id <=> p_modo_id_anterior)) THEN
    IF (SELECT COUNT(*) FROM modos WHERE id = p_modo_id AND archivado = 0) = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El modo no existe o esta archivado';
    END IF;
  END IF;
END$$

CREATE PROCEDURE sp_validar_presupuesto(
  IN p_es_insert TINYINT,
  IN p_categoria_id BIGINT
)
BEGIN
  DECLARE v_ok INT DEFAULT 0;

  SELECT COUNT(*) INTO v_ok
  FROM categorias c
  JOIN tipos_movimiento t ON t.id = c.tipo_id
  WHERE c.id = p_categoria_id
    AND t.codigo = 'gasto'
    AND (p_es_insert = 0 OR c.archivado = 0);

  IF v_ok = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El presupuesto solo aplica a categorias de gasto';
  END IF;
END$$

-- Ingresos, gastos y ahorro (ingresos - gastos) entre dos fechas.
-- Las transferencias no entran.
-- Uso: CALL sp_resumen_periodo('2026-09-01', '2026-09-30');
CREATE PROCEDURE sp_resumen_periodo(
  IN p_desde DATE,
  IN p_hasta DATE
)
BEGIN
  SELECT
    CAST(COALESCE(SUM(CASE
      WHEN t.efecto = 'suma' AND t.cuenta_en_periodo = 1 THEN m.monto
      ELSE 0
    END), 0) AS DECIMAL(14, 2)) AS ingresos,
    CAST(COALESCE(SUM(CASE
      WHEN t.efecto = 'resta' AND t.cuenta_en_periodo = 1 THEN m.monto
      ELSE 0
    END), 0) AS DECIMAL(14, 2)) AS gastos,
    CAST(
      COALESCE(SUM(CASE
        WHEN t.efecto = 'suma' AND t.cuenta_en_periodo = 1 THEN m.monto
        ELSE 0
      END), 0)
      - COALESCE(SUM(CASE
        WHEN t.efecto = 'resta' AND t.cuenta_en_periodo = 1 THEN m.monto
        ELSE 0
      END), 0)
    AS DECIMAL(14, 2)) AS ahorro
  FROM movimientos m
  JOIN tipos_movimiento t ON t.id = m.tipo_id
  WHERE m.fecha >= p_desde
    AND m.fecha <= p_hasta;
END$$

-- Total del periodo por categoría. Sirve a Categorías, el donut y Reportes.
-- Uso: CALL sp_totales_categoria('2026-09-01', '2026-09-30');
CREATE PROCEDURE sp_totales_categoria(
  IN p_desde DATE,
  IN p_hasta DATE
)
BEGIN
  SELECT
    c.id AS categoria_id,
    c.nombre AS categoria,
    t.codigo AS tipo_codigo,
    t.nombre AS tipo,
    CAST(COALESCE(SUM(m.monto), 0) AS DECIMAL(14, 2)) AS total
  FROM categorias c
  JOIN tipos_movimiento t ON t.id = c.tipo_id
  LEFT JOIN movimientos m
    ON m.categoria_id = c.id
   AND m.fecha >= p_desde
   AND m.fecha <= p_hasta
  WHERE c.archivado = 0 OR m.id IS NOT NULL
  GROUP BY c.id, c.nombre, t.codigo, t.nombre
  ORDER BY t.codigo, c.nombre;
END$$

CREATE TRIGGER trg_tipos_movimiento_bu
BEFORE UPDATE ON tipos_movimiento
FOR EACH ROW
BEGIN
  IF OLD.es_sistema = 1 AND NOT (NEW.codigo <=> OLD.codigo) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede cambiar el codigo de un tipo de sistema';
  END IF;

  IF OLD.es_sistema = 1 AND NOT (NEW.efecto <=> OLD.efecto) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede cambiar el efecto de un tipo de sistema';
  END IF;
END$$

CREATE TRIGGER trg_tipos_movimiento_bd
BEFORE DELETE ON tipos_movimiento
FOR EACH ROW
BEGIN
  IF OLD.es_sistema = 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede eliminar un tipo de sistema';
  END IF;
END$$

CREATE TRIGGER trg_movimientos_bi
BEFORE INSERT ON movimientos
FOR EACH ROW
BEGIN
  CALL sp_validar_movimiento(
    1,
    NEW.tipo_id, NULL,
    NEW.categoria_id, NULL,
    NEW.modo_id, NULL,
    NEW.cuenta_id, NULL,
    NEW.cuenta_destino_id, NULL,
    NEW.meta_id,
    NEW.deuda_id
  );
END$$

CREATE TRIGGER trg_movimientos_bu
BEFORE UPDATE ON movimientos
FOR EACH ROW
BEGIN
  CALL sp_validar_movimiento(
    0,
    NEW.tipo_id, OLD.tipo_id,
    NEW.categoria_id, OLD.categoria_id,
    NEW.modo_id, OLD.modo_id,
    NEW.cuenta_id, OLD.cuenta_id,
    NEW.cuenta_destino_id, OLD.cuenta_destino_id,
    NEW.meta_id,
    NEW.deuda_id
  );
END$$

CREATE TRIGGER trg_presupuestos_bi
BEFORE INSERT ON presupuestos
FOR EACH ROW
BEGIN
  CALL sp_validar_presupuesto(1, NEW.categoria_id);
END$$

CREATE TRIGGER trg_presupuestos_bu
BEFORE UPDATE ON presupuestos
FOR EACH ROW
BEGIN
  CALL sp_validar_presupuesto(0, NEW.categoria_id);
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
-- Vistas: lecturas que alimentan las pantallas
-- ---------------------------------------------------------------------------

-- Saldo actual = saldo inicial + ingresos - gastos y pagos
-- + transferencias recibidas - transferencias enviadas, desde fecha_saldo_inicial.
CREATE VIEW v_cuentas AS
SELECT
  c.id,
  c.nombre,
  c.institucion,
  c.tipo_cuenta_id,
  tc.nombre AS tipo_cuenta,
  c.saldo_inicial,
  c.fecha_saldo_inicial,
  c.archivado,
  CAST(
    c.saldo_inicial
    + COALESCE((
        SELECT SUM(
          CASE t.efecto
            WHEN 'suma' THEN m.monto
            WHEN 'resta' THEN -m.monto
            WHEN 'traslado' THEN -m.monto
            ELSE 0
          END
        )
        FROM movimientos m
        JOIN tipos_movimiento t ON t.id = m.tipo_id
        WHERE m.cuenta_id = c.id
          AND m.fecha >= c.fecha_saldo_inicial
      ), 0)
    + COALESCE((
        SELECT SUM(m.monto)
        FROM movimientos m
        JOIN tipos_movimiento t ON t.id = m.tipo_id
        WHERE m.cuenta_destino_id = c.id
          AND t.efecto = 'traslado'
          AND m.fecha >= c.fecha_saldo_inicial
      ), 0)
  AS DECIMAL(14, 2)) AS saldo_actual,
  (
    SELECT MAX(m.fecha)
    FROM movimientos m
    WHERE m.cuenta_id = c.id OR m.cuenta_destino_id = c.id
  ) AS ultima_fecha
FROM cuentas c
JOIN tipos_cuenta tc ON tc.id = c.tipo_cuenta_id;

-- Gastado = suma de movimientos de esa categoría dentro del periodo del mes.
-- excedido es lo que dispara el aviso de ajustes.
CREATE VIEW v_presupuestos AS
SELECT
  base.id,
  base.categoria_id,
  base.categoria,
  base.anio,
  base.mes,
  base.tope,
  base.desde,
  base.hasta_exclusivo,
  CAST(COALESCE(SUM(CASE WHEN t.id IS NOT NULL THEN m.monto ELSE 0 END), 0) AS DECIMAL(14, 2)) AS gastado,
  CASE
    WHEN base.tope = 0 THEN 0
    ELSE ROUND(
      COALESCE(SUM(CASE WHEN t.id IS NOT NULL THEN m.monto ELSE 0 END), 0) / base.tope * 100,
      2
    )
  END AS porcentaje,
  COALESCE(SUM(CASE WHEN t.id IS NOT NULL THEN m.monto ELSE 0 END), 0) > base.tope AS excedido
FROM (
  SELECT
    p.id,
    p.categoria_id,
    cat.nombre AS categoria,
    p.anio,
    p.mes,
    p.tope,
    STR_TO_DATE(
      CONCAT(p.anio, '-', LPAD(p.mes, 2, '0'), '-', LPAD(pf.dia_inicio_mes, 2, '0')),
      '%Y-%m-%d'
    ) AS desde,
    DATE_ADD(
      STR_TO_DATE(
        CONCAT(p.anio, '-', LPAD(p.mes, 2, '0'), '-', LPAD(pf.dia_inicio_mes, 2, '0')),
        '%Y-%m-%d'
      ),
      INTERVAL 1 MONTH
    ) AS hasta_exclusivo
  FROM presupuestos p
  JOIN categorias cat ON cat.id = p.categoria_id
  JOIN perfil pf ON pf.id = 1
) base
LEFT JOIN movimientos m
  ON m.categoria_id = base.categoria_id
 AND m.fecha >= base.desde
 AND m.fecha < base.hasta_exclusivo
LEFT JOIN tipos_movimiento t
  ON t.id = m.tipo_id
 AND t.efecto = 'resta'
 AND t.cuenta_en_periodo = 1
GROUP BY
  base.id,
  base.categoria_id,
  base.categoria,
  base.anio,
  base.mes,
  base.tope,
  base.desde,
  base.hasta_exclusivo;

-- El ahorrado suma los movimientos marcados con meta_id.
CREATE VIEW v_metas AS
SELECT
  g.id,
  g.nombre,
  g.objetivo,
  g.fecha_objetivo,
  g.cuenta_id,
  g.archivado,
  CAST(g.ahorrado_inicial + COALESCE(a.total, 0) AS DECIMAL(14, 2)) AS ahorrado,
  CASE
    WHEN g.objetivo = 0 THEN 0
    ELSE ROUND((g.ahorrado_inicial + COALESCE(a.total, 0)) / g.objetivo * 100, 2)
  END AS porcentaje
FROM metas g
LEFT JOIN (
  SELECT m.meta_id, SUM(m.monto) AS total
  FROM movimientos m
  JOIN tipos_movimiento t ON t.id = m.tipo_id
  WHERE m.meta_id IS NOT NULL
    AND t.efecto IN ('resta', 'traslado')
  GROUP BY m.meta_id
) a ON a.meta_id = g.id;

-- estado: vencida si la cuota ya pasó; proxima si cae en los próximos 7 días; si no, al dia.
CREATE VIEW v_deudas AS
SELECT
  d.id,
  d.nombre,
  d.acreedor,
  d.saldo_inicial,
  d.cuota,
  d.proxima_fecha,
  d.archivado,
  CAST(
    d.saldo_inicial
    - COALESCE((
        SELECT SUM(m.monto)
        FROM movimientos m
        JOIN tipos_movimiento t ON t.id = m.tipo_id
        WHERE m.deuda_id = d.id
          AND t.efecto = 'resta'
      ), 0)
  AS DECIMAL(14, 2)) AS saldo,
  CASE
    WHEN d.proxima_fecha IS NULL THEN 'al dia'
    WHEN d.proxima_fecha < CURRENT_DATE THEN 'vencida'
    WHEN d.proxima_fecha <= CURRENT_DATE + INTERVAL 7 DAY THEN 'proxima'
    ELSE 'al dia'
  END AS estado
FROM deudas d;

-- Lista de transacciones con los nombres ya resueltos.
CREATE VIEW v_movimientos AS
SELECT
  m.id,
  m.fecha,
  m.monto,
  m.descripcion,
  m.tipo_id,
  t.codigo AS tipo_codigo,
  t.nombre AS tipo,
  t.efecto,
  m.categoria_id,
  cat.nombre AS categoria,
  m.modo_id,
  mo.nombre AS modo,
  m.cuenta_id,
  cu.nombre AS cuenta,
  m.cuenta_destino_id,
  cd.nombre AS cuenta_destino,
  m.meta_id,
  me.nombre AS meta,
  m.deuda_id,
  de.nombre AS deuda,
  m.creado_en,
  m.actualizado_en
FROM movimientos m
JOIN tipos_movimiento t ON t.id = m.tipo_id
JOIN cuentas cu ON cu.id = m.cuenta_id
LEFT JOIN categorias cat ON cat.id = m.categoria_id
LEFT JOIN modos mo ON mo.id = m.modo_id
LEFT JOIN cuentas cd ON cd.id = m.cuenta_destino_id
LEFT JOIN metas me ON me.id = m.meta_id
LEFT JOIN deudas de ON de.id = m.deuda_id;

-- ---------------------------------------------------------------------------
-- Datos iniciales
-- Catálogos + entidades de ejemplo. Sin movimientos: si se cargaran encima de
-- estos saldos iniciales, los saldos visibles dejarían de coincidir.
-- ---------------------------------------------------------------------------

INSERT INTO perfil (nombre, correo, moneda, dia_inicio_mes, aviso_cuotas, aviso_presupuesto, resumen_semanal)
VALUES ('Esteban', 'esteban@localhost', 'USD', 1, TRUE, TRUE, FALSE);

INSERT INTO tipos_movimiento (codigo, nombre, efecto, cuenta_en_periodo, es_sistema) VALUES
  ('ingreso',       'Ingreso',        'suma',     TRUE,  TRUE),
  ('gasto',         'Gasto',          'resta',    TRUE,  TRUE),
  ('pago_deuda',    'Pago de deuda',  'resta',    TRUE,  TRUE),
  ('transferencia', 'Transferencia',  'traslado', FALSE, TRUE);

INSERT INTO modos (nombre) VALUES
  ('Efectivo'),
  ('Transferencia'),
  ('Tarjeta débito'),
  ('Tarjeta crédito');

INSERT INTO tipos_cuenta (nombre) VALUES
  ('Efectivo'),
  ('Banco'),
  ('Cooperativa'),
  ('Tarjeta');

INSERT INTO tipos_inversion (nombre) VALUES
  ('ETF'),
  ('Fondo'),
  ('Acciones');

INSERT INTO categorias (tipo_id, nombre)
SELECT t.id, c.nombre
FROM tipos_movimiento t
JOIN (
  SELECT 'ingreso' AS codigo, 'Salario' AS nombre
  UNION ALL SELECT 'ingreso', 'Freelance'
  UNION ALL SELECT 'ingreso', 'Inversiones'
  UNION ALL SELECT 'ingreso', 'Otros ingresos'
  UNION ALL SELECT 'gasto', 'Alimentación'
  UNION ALL SELECT 'gasto', 'Vivienda'
  UNION ALL SELECT 'gasto', 'Transporte'
  UNION ALL SELECT 'gasto', 'Entretenimiento'
  UNION ALL SELECT 'gasto', 'Salud'
  UNION ALL SELECT 'gasto', 'Servicios'
  UNION ALL SELECT 'gasto', 'Compras'
  UNION ALL SELECT 'pago_deuda', 'Cuotas'
  UNION ALL SELECT 'pago_deuda', 'Tarjetas'
) c ON c.codigo = t.codigo;

INSERT INTO cuentas (tipo_cuenta_id, nombre, institucion, saldo_inicial, fecha_saldo_inicial)
SELECT tc.id, v.nombre, v.institucion, v.saldo, '2026-09-01'
FROM tipos_cuenta tc
JOIN (
  SELECT 'Efectivo' AS tipo, 'Efectivo' AS nombre, CAST(NULL AS CHAR(150)) AS institucion, CAST(340.00 AS DECIMAL(14, 2)) AS saldo
  UNION ALL SELECT 'Banco', 'Cuenta nómina', 'Banco', 7850.00
  UNION ALL SELECT 'Banco', 'Banco digital', 'Banco digital', 4200.00
  UNION ALL SELECT 'Tarjeta', 'Tarjeta débito', NULL, 450.00
) v ON v.tipo = tc.nombre;

INSERT INTO presupuestos (categoria_id, anio, mes, tope)
SELECT c.id, 2026, 9, v.tope
FROM categorias c
JOIN tipos_movimiento t ON t.id = c.tipo_id AND t.codigo = 'gasto'
JOIN (
  SELECT 'Alimentación' AS nombre, CAST(500.00 AS DECIMAL(14, 2)) AS tope
  UNION ALL SELECT 'Transporte', 200.00
  UNION ALL SELECT 'Vivienda', 900.00
  UNION ALL SELECT 'Entretenimiento', 150.00
  UNION ALL SELECT 'Salud', 120.00
  UNION ALL SELECT 'Servicios', 200.00
) v ON v.nombre = c.nombre;

INSERT INTO metas (nombre, objetivo, fecha_objetivo, ahorrado_inicial) VALUES
  ('Fondo de emergencia', 6000.00, '2026-12-31', 4200.00),
  ('Viaje',               3000.00, '2027-03-31', 1150.00),
  ('Laptop nueva',        1200.00, '2026-11-30',  800.00);

INSERT INTO deudas (nombre, saldo_inicial, cuota, proxima_fecha) VALUES
  ('Tarjeta de crédito', 2340.00, 180.00, '2026-10-05'),
  ('Préstamo auto',      8900.00, 310.00, '2026-10-02'),
  ('Préstamo personal',   640.00,  80.00, '2026-09-18');

INSERT INTO inversiones (tipo_inversion_id, nombre, valor_actual, variacion_pct)
SELECT ti.id, v.nombre, v.valor, v.variacion
FROM tipos_inversion ti
JOIN (
  SELECT 'ETF' AS tipo, 'ETF global' AS nombre, CAST(3200.00 AS DECIMAL(14, 2)) AS valor, CAST(4.20 AS DECIMAL(7, 2)) AS variacion
  UNION ALL SELECT 'Fondo', 'Fondo indexado', 1800.00, 1.60
  UNION ALL SELECT 'Acciones', 'Acciones locales', 740.00, -0.80
) v ON v.tipo = ti.nombre;

INSERT INTO inversion_historico (inversion_id, fecha, valor, variacion_pct)
SELECT id, '2026-09-01', valor_actual, variacion_pct
FROM inversiones;
