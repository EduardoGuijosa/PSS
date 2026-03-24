console.log("SERVER CORRECTO");

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const connection = require("./db");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

/* =========================
   CONFIG
========================= */
const JWT_SECRET = "clave-super-secreta";

/* =========================
   MIDDLEWARE AUTH 
========================= */
function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expirado" });
    }
    return res.status(401).json({ error: "Token inválido" });
  }
}

/* =========================
   MIDDLEWARE ROLES 
========================= */
function requireRole(...roles) {
  return (req, res, next) => {
    const userRol = req.user.rol.toLowerCase();

    if (!roles.map((r) => r.toLowerCase()).includes(userRol)) {
      return res.status(403).json({ error: "Sin permisos" });
    }

    next();
  };
}

/* =========================
   LOGIN 
========================= */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const sql = `
    SELECT u.idusuario, u.nombre, r.nombreRol
    FROM usuario u
    INNER JOIN rol r ON u.idRol = r.idRol
    WHERE u.email = ? AND u.password = ?
  `;

  connection.query(sql, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: "Error BD" });

    if (results.length === 0) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const user = results[0];

    const token = jwt.sign(
      {
        id: user.idusuario,
        nombre: user.nombre,
        rol: user.nombreRol,
      },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.json({
      token,
      usuario: user.nombre.toLowerCase(),
      rol: user.nombreRol.toLowerCase(),
    });
  });
});

/* =========================
   CRUD ACTIVIDADES 
========================= */

// TODOS pueden ver
app.get("/api/actividad", auth, (req, res) => {
  let sql = `
SELECT 
  a.idactividad,
  a.nombreActividad,
  a.descripcion,
  a.horas_actividad,
  a.totalAlumnosRequeridos,
  a.fecha_alta,
  a.fechaTermino,
  a.idresponsable,
  u.nombre AS responsable,

  COUNT(aa.idactividad) AS inscritos,

  MAX(CASE 
    WHEN aa.matricula = (
      SELECT matricula FROM alumno WHERE idusuario = ?
    ) THEN 1 ELSE 0 
  END) AS inscrito

FROM actividad a

LEFT JOIN responsable r ON a.idresponsable = r.idresponsable
LEFT JOIN usuario u ON r.idusuario = u.idusuario

LEFT JOIN asignacion_actividad aa 
  ON a.idactividad = aa.idactividad

GROUP BY a.idactividad
`;

  let params = [req.user.id];

  // Filtrar por responsable para que solo vea sus actividades
  if (req.user.rol.toLowerCase() === "responsable") {
    sql += `
    HAVING a.idresponsable = (
      SELECT idresponsable 
      FROM responsable 
      WHERE idusuario = ?
    )
  `;
    params.push(req.user.id);
  }

  // ORDEN CORRECTO (AL FINAL)
  sql += " ORDER BY a.fecha_alta DESC, a.horas_actividad DESC";

  connection.query(sql, params, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json([]);
    }
    res.json(results);
  });
});

// CREAR
app.post("/api/actividad", auth, requireRole("responsable"), (req, res) => {
  const {
    nombreActividad,
    descripcion,
    horas_actividad,
    fecha_alta,
    fechaTermino,
    totalAlumnosRequeridos,
  } = req.body;

  const sqlResponsable = `
    SELECT idresponsable 
    FROM responsable 
    WHERE idusuario = ?
  `;

  connection.query(sqlResponsable, [req.user.id], (err, result) => {
    if (err || result.length === 0) {
      return res.status(500).json({ msg: "No se encontró responsable" });
    }

    const idresponsable = result[0].idresponsable;

    const sqlInsert = `
      INSERT INTO actividad 
      (nombreActividad, descripcion, horas_actividad, fecha_alta, fechaTermino, totalAlumnosRequeridos, idresponsable)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(
      sqlInsert,
      [
        nombreActividad,
        descripcion,
        horas_actividad,
        fecha_alta,
        fechaTermino,
        totalAlumnosRequeridos,
        idresponsable,
      ],
      (err2) => {
        if (err2) {
          console.log(err2);
          return res.status(500).json({ msg: "Error al crear actividad" });
        }
        res.json({ success: true });
      },
    );
  });
});

// EDITAR
app.put("/api/actividad/:id", auth, requireRole("responsable"), (req, res) => {
  const { id } = req.params;

  const {
    nombreActividad,
    descripcion,
    horas_actividad,
    fecha_alta,
    fechaTermino,
    totalAlumnosRequeridos,
  } = req.body;

  const sql = `
    UPDATE actividad 
    SET nombreActividad=?, descripcion=?, horas_actividad=?, fecha_alta=?, fechaTermino=?, totalAlumnosRequeridos=?
    WHERE idactividad=?
  `;

  connection.query(
    sql,
    [
      nombreActividad,
      descripcion,
      horas_actividad,
      fecha_alta,
      fechaTermino,
      totalAlumnosRequeridos,
      id,
    ],
    (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: "Error al editar" });
      }
      res.json({ success: true });
    },
  );
});

// ELIMINAR
app.delete(
  "/api/actividad/:id",
  auth,
  requireRole("responsable"),
  (req, res) => {
    const { id } = req.params;

    connection.query(
      "DELETE FROM actividad WHERE idactividad = ?",
      [id],
      (err) => {
        if (err) return res.status(500).json({ error: "Error al eliminar" });
        res.json({ success: true });
      },
    );
  },
);

/* =========================
   RESPONSABLES 
========================= */
app.get("/api/responsables", auth, (req, res) => {
  const sql = `
    SELECT r.idresponsable, u.nombre
    FROM responsable r
    INNER JOIN usuario u ON r.idusuario = u.idusuario
  `;

  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json([]);
    res.json(results);
  });
});

/* =========================
   ALUMNOS 
========================= */
app.get("/api/alumnos", auth, (req, res) => {
  let sql = `
    SELECT 
  a.matricula,
  u.nombre,
  u.email,
  u.telefono,
  g.grupo,
  g.cuatrimestre,

  IFNULL(SUM(
    CASE 
      WHEN aa.estado = 'completado' THEN act.horas_actividad
      ELSE 0
    END
  ), 0) AS horas_liberadas,

  GROUP_CONCAT(
  CONCAT('• ', act.nombreActividad, ' (', aa.estado, ')')
  SEPARATOR '\n'
) AS actividades

FROM alumno a
INNER JOIN usuario u ON a.idusuario = u.idusuario
INNER JOIN grupo g ON a.idgrupo = g.idgrupo

LEFT JOIN asignacion_actividad aa 
  ON a.matricula = aa.matricula

LEFT JOIN actividad act 
  ON aa.idactividad = act.idactividad
  `;

  if (req.user.rol.toLowerCase() === "tutor") {
    sql += `
      INNER JOIN tutor t ON g.idtutor = t.idtutor
      WHERE t.idusuario = ?
    `;
  }

  sql += " GROUP BY a.matricula";

  const params = req.user.rol.toLowerCase() === "tutor" ? [req.user.id] : [];

  connection.query(sql, params, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json([]);
    }
    res.json(results);
  });
});

/* =========================
CRUD Tareas_Actividad
========================== */

// Consultar
app.get("/api/tareas/:idactividad", auth, (req, res) => {
  const { idactividad } = req.params;

  const sql = `
    SELECT * 
    FROM tareas_actividad
    WHERE idactividad = ?
    ORDER BY fechaEjecucion ASC
  `;

  connection.query(sql, [idactividad], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json([]);
    }
    res.json(results);
  });
});

// Crear tarea con validaciones
app.post("/api/tareas", auth, requireRole("responsable"), (req, res) => {
  let { idactividad, nombre_tarea, horas_Tareas, fechaEjecucion } = req.body;

  // CONVERTIR A NÚMERO
  horas_Tareas = Number(horas_Tareas);
  idactividad = Number(idactividad);

  // VALIDACIÓN BÁSICA
  if (!idactividad || !nombre_tarea || !horas_Tareas) {
    return res.status(400).json({ msg: "Datos incompletos" });
  }

  // 1. SUMAR HORAS ACTUALES
  const sqlSuma = `
    SELECT IFNULL(SUM(horas_Tareas),0) AS total 
    FROM tareas_actividad 
    WHERE idactividad = ?
  `;

  connection.query(sqlSuma, [idactividad], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ msg: "Error al validar horas" });
    }

    const totalActual = Number(result[0].total) || 0;

    // 2. OBTENER HORAS DE LA ACTIVIDAD
    const sqlActividad = `
      SELECT horas_actividad 
      FROM actividad 
      WHERE idactividad = ?
    `;

    connection.query(sqlActividad, [idactividad], (err2, result2) => {
      if (err2 || result2.length === 0) {
        return res.status(500).json({ msg: "Actividad no encontrada" });
      }

      const horasActividad = Number(result2[0].horas_actividad);

      // VALIDACIÓN CORRECTA
      if (totalActual + horas_Tareas > horasActividad) {
        return res.status(400).json({
          msg: "Las horas exceden el total de la actividad",
        });
      }

      // 3. INSERT
      const sqlInsert = `
        INSERT INTO tareas_actividad 
        (idactividad, nombre_tarea, horas_Tareas, fechaEjecucion)
        VALUES (?, ?, ?, ?)
      `;

      connection.query(
        sqlInsert,
        [idactividad, nombre_tarea, horas_Tareas, fechaEjecucion],
        (err3) => {
          if (err3) {
            console.log(err3);
            return res.status(500).json({ msg: "Error al crear tarea" });
          }

          res.json({ success: true });
        },
      );
    });
  });
});

// Editar
app.put("/api/tareas/:id", auth, requireRole("responsable"), (req, res) => {
  const { id } = req.params;

  const { nombre_tarea, horas_Tareas, fechaEjecucion } = req.body;

  const sql = `
    UPDATE tareas_actividad
    SET nombre_tarea = ?, horas_Tareas = ?, fechaEjecucion = ?
    WHERE idTareas_Actividad = ?
  `;

  connection.query(
    sql,
    [nombre_tarea, horas_Tareas, fechaEjecucion, id],
    (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ msg: "Error al editar tarea" });
      }

      res.json({ success: true });
    },
  );
});

// Eliminar
app.delete("/api/tareas/:id", auth, requireRole("responsable"), (req, res) => {
  const { id } = req.params;

  const sql = `
    DELETE FROM tareas_actividad 
    WHERE idTareas_Actividad = ?
  `;

  connection.query(sql, [id], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ msg: "Error al eliminar tarea" });
    }

    res.json({ success: true });
  });
});

/* =========================
   API donde los alumnos pueden elegir actividades
========================= */
app.post("/api/asignacion", auth, requireRole("alumno"), (req, res) => {
  const idUsuario = req.user.id;
  const { idactividad } = req.body;

  // 🔒 Validación básica
  if (!idactividad) {
    return res.status(400).json({ msg: "ID de actividad requerido" });
  }

  // 1️⃣ OBTENER MATRÍCULA DEL ALUMNO
  const sqlAlumno = `
    SELECT matricula 
    FROM alumno 
    WHERE idusuario = ?
  `;

  connection.query(sqlAlumno, [idUsuario], (err, resultAlumno) => {
    if (err || resultAlumno.length === 0) {
      return res.status(500).json({ msg: "Alumno no encontrado" });
    }

    const matricula = resultAlumno[0].matricula;

    // 2️⃣ OBTENER HORAS ACTUALES DEL ALUMNO
    const sqlHorasActuales = `
      SELECT IFNULL(SUM(a.horas_actividad),0) AS total
      FROM asignacion_actividad aa
      INNER JOIN actividad a ON aa.idactividad = a.idactividad
      WHERE aa.matricula = ?
    `;

    connection.query(sqlHorasActuales, [matricula], (errH, resultH) => {
      if (errH) {
        return res.status(500).json({ msg: "Error al calcular horas" });
      }

      const horasActuales = Number(resultH[0].total);

      // 3️⃣ OBTENER DATOS DE LA ACTIVIDAD
      const sqlActividad = `
        SELECT horas_actividad, totalAlumnosRequeridos 
        FROM actividad 
        WHERE idactividad = ?
      `;

      connection.query(sqlActividad, [idactividad], (err2, resultAct) => {
        if (err2 || resultAct.length === 0) {
          return res.status(500).json({ msg: "Actividad no encontrada" });
        }

        const horasActividad = Number(resultAct[0].horas_actividad);
        const cupo = resultAct[0].totalAlumnosRequeridos;

        // 🔥 4️⃣ VALIDAR LÍMITE DE 480 HORAS
        const nuevasHoras = horasActuales + horasActividad;

        if (nuevasHoras > 480) {
          const faltantes = 480 - horasActuales;

          return res.status(400).json({
            msg: `⚠️ Ya llevas ${horasActuales} horas. Solo puedes agregar ${faltantes} más para llegar a 480.`,
          });
        }

        // 5️⃣ CONTAR CUÁNTOS ALUMNOS YA ESTÁN INSCRITOS
        const sqlCount = `
          SELECT COUNT(*) AS total 
          FROM asignacion_actividad 
          WHERE idactividad = ?
        `;

        connection.query(sqlCount, [idactividad], (err3, resultCount) => {
          if (err3) {
            return res.status(500).json({ msg: "Error al verificar cupo" });
          }

          const inscritos = resultCount[0].total;

          // 🔴 VALIDAR CUPO DISPONIBLE
          if (inscritos >= cupo) {
            return res.status(400).json({ msg: "❌ Actividad llena" });
          }

          // 6️⃣ VALIDAR SI EL ALUMNO YA ESTÁ INSCRITO
          const sqlCheck = `
            SELECT * 
            FROM asignacion_actividad 
            WHERE idactividad = ? AND matricula = ?
          `;

          connection.query(
            sqlCheck,
            [idactividad, matricula],
            (err4, resultCheck) => {
              if (err4) {
                return res
                  .status(500)
                  .json({ msg: "Error al verificar inscripción" });
              }

              if (resultCheck.length > 0) {
                return res
                  .status(400)
                  .json({ msg: "⚠️ Ya estás inscrito en esta actividad" });
              }

              // 7️⃣ INSERTAR INSCRIPCIÓN
              const sqlInsert = `
                INSERT INTO asignacion_actividad 
                (matricula, estado, idactividad)
                VALUES (?, 'Asignada', ?)
              `;

              connection.query(sqlInsert, [matricula, idactividad], (err5) => {
                if (err5) {
                  console.log(err5);
                  return res
                    .status(500)
                    .json({ msg: "Error al registrar inscripción" });
                }

                // 🎯 8️⃣ RESPUESTA FINAL
                const totalFinal = nuevasHoras;
                const faltantes = 480 - totalFinal;

                res.json({
                  success: true,
                  msg: `✅ Inscripción exitosa. Ahora llevas ${totalFinal} horas. Te faltan ${faltantes} para completar las 480.`,
                  horasActuales: totalFinal,
                  horasRestantes: faltantes,
                });
              });
            },
          );
        });
      });
    });
  });
});

/* =========================
   PROGRESO ALUMNO
========================= */
app.get("/api/progreso", auth, requireRole("alumno"), (req, res) => {
  const idUsuario = req.user.id;

  // 1. Obtener matrícula
  const sqlAlumno = `
    SELECT matricula 
    FROM alumno 
    WHERE idusuario = ?
  `;

  connection.query(sqlAlumno, [idUsuario], (err, resultAlumno) => {
    if (err || resultAlumno.length === 0) {
      return res.status(500).json({ msg: "Alumno no encontrado" });
    }

    const matricula = resultAlumno[0].matricula;

    // 2. Obtener actividades + estado
    const sql = `
      SELECT 
        a.idactividad,
        a.nombreActividad,
        a.descripcion,
        a.horas_actividad,
        a.fecha_alta,
        a.fechaTermino,
        aa.estado
      FROM asignacion_actividad aa
      INNER JOIN actividad a ON aa.idactividad = a.idactividad
      WHERE aa.matricula = ?
    `;

    connection.query(sql, [matricula], (err2, actividades) => {
      if (err2) {
        return res.status(500).json({ msg: "Error al obtener progreso" });
      }

      // SOLO CONTAR TERMINADAS
      let horasLiberadas = 0;

      actividades.forEach((act) => {
        if (act.estado === "Terminado") {
          horasLiberadas += Number(act.horas_actividad);
        }
      });

      // evitar negativos
      const horasFaltantes = Math.max(0, 480 - horasLiberadas);

      res.json({
        horasLiberadas,
        horasFaltantes,
        actividades,
      });
    });
  });
});

/* =========================
   SERVER 
========================= */
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
