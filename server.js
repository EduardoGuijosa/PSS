// Mensaje simple para confirmar en consola que este archivo server.js sí está corriendo
console.log("SERVER CORRECTO");

// =========================
// IMPORTACIÓN DE LIBRERÍAS
// =========================

// Se requiere express, que es la librería principal para crear el servidor y las rutas de la API
const express = require("express");

// Se requiere cors, que permite que el frontend pueda hacer peticiones a este backend aunque estén en rutas o puertos distintos
const cors = require("cors");

// Se requiere jsonwebtoken, que sirve para crear y validar tokens JWT
const jwt = require("jsonwebtoken");

// Se importa la conexión a la base de datos desde el archivo db.js
const connection = require("./db");

// Se importa la librería multer para manejar subidas de archivos
const multer = require("multer");

// Se importa la librería path para manejar rutas de archivos
const path = require("path");

// Se crea la aplicación principal de express y se guarda en la constante app
const app = express();

// Se importa la librería fs para manejar archivos en el sistema, como eliminar fotos antiguas
const fs = require("fs");

// Se define el puerto donde va a correr el servidor
const PORT = 3000;

// =========================
// MIDDLEWARES GENERALES
// =========================

// app.use(cors()) habilita CORS para permitir peticiones desde el frontend
app.use(cors());

// app.use(express.json()) permite que express entienda datos en formato JSON enviados en req.body
app.use(express.json());

/* =========================
   CONFIG
========================= */

// Clave secreta usada para firmar y verificar tokens JWT
const JWT_SECRET = "clave-super-secreta";

/* =========================
   MIDDLEWARE AUTH
========================= */

// Este middleware valida que la petición traiga un token JWT válido
function auth(req, res, next) {
  // Se obtiene el encabezado Authorization de la petición
  const header = req.headers.authorization;

  // Si no existe el header o no comienza con "Bearer ", se rechaza la petición
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }

  // Se separa el token del texto "Bearer "
  const token = header.split(" ")[1];

  // Si por alguna razón no vino token después de Bearer
  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  try {
    // jwt.verify valida el token usando la clave secreta
    // Si es válido, los datos del token se guardan en req.user
    req.user = jwt.verify(token, JWT_SECRET);

    // Si el token no trae rol, se bloquea por seguridad
    if (!req.user || !req.user.rol) {
      return res
        .status(401)
        .json({ error: "Token inválido: rol no encontrado" });
    }

    // next() permite que la petición continúe hacia la siguiente función o ruta
    next();
  } catch (error) {
    // Si el token expiró, se responde con ese mensaje específico
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expirado" });
    }

    // Si hay cualquier otro error, significa que el token es inválido
    return res.status(401).json({ error: "Token inválido" });
  }
}

/* =========================
   MIDDLEWARE ROLES
========================= */

// Esta función recibe uno o varios roles permitidos y regresa un middleware
function requireRole(...roles) {
  return (req, res, next) => {
    // Primero se verifica que exista req.user y que dentro de req.user sí exista el rol
    if (!req.user || !req.user.rol) {
      console.error("Error: intento de acceso sin rol definido en req.user");
      return res
        .status(403)
        .json({ error: "No autorizado: rol no encontrado" });
    }

    // Se toma el rol del usuario, se convierte a texto, se limpia y se pasa a minúsculas
    const userRol = String(req.user.rol).trim().toLowerCase();

    // También se convierten los roles permitidos a minúsculas y sin espacios sobrantes
    const rolesPermitidos = roles.map((r) => String(r).trim().toLowerCase());

    // Si el rol del usuario no está dentro de los permitidos, se bloquea
    if (!rolesPermitidos.includes(userRol)) {
      console.warn(
        `Bloqueado: el rol '${userRol}' intentó entrar a una ruta permitida solo para: ${rolesPermitidos.join(", ")}`,
      );
      return res.status(403).json({ error: "Sin permisos suficientes" });
    }

    // Si todo está correcto, se permite el acceso a la ruta
    next();
  };
}

// =========================
// CONFIGURACIÓN DE MULTER
// =========================
const storageFotoAlumno = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads/alumnos"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nombreArchivo = `alumno_${req.user.idusuario}_${Date.now()}${ext}`;
    cb(null, nombreArchivo);
  },
});

const fileFilterImagen = (req, file, cb) => {
  const tiposPermitidos = /jpeg|jpg|png|webp/;
  const ext = tiposPermitidos.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mime = tiposPermitidos.test(file.mimetype);

  console.log("Ext válida:", ext);
  console.log("Mime válido:", mime);

  if (ext && mime) {
    return cb(null, true);
  }

  cb(new Error("Solo se permiten imágenes JPG, PNG o WEBP"));
};

const uploadFotoAlumno = multer({
  storage: storageFotoAlumno,
  fileFilter: fileFilterImagen,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/* =========================================================
   HELPERS ADMIN
========================================================= */

// Obtiene el idRol a partir del nombre del rol
function obtenerIdRolPorNombre(nombreRol, callback) {
  const sql = `
    SELECT idRol
    FROM rol
    WHERE LOWER(nombreRol) = LOWER(?)
    LIMIT 1
  `;

  connection.query(sql, [nombreRol], (err, result) => {
    if (err) return callback(err);

    if (!result || result.length === 0) {
      return callback(new Error(`Rol no encontrado: ${nombreRol}`));
    }

    callback(null, result[0].idRol);
  });
}

// Valida si ya existe un usuario por email
function existeUsuarioPorEmail(email, callback) {
  const sql = `
    SELECT idusuario
    FROM usuario
    WHERE email = ?
    LIMIT 1
  `;

  connection.query(sql, [email], (err, result) => {
    if (err) return callback(err);
    callback(null, result && result.length > 0);
  });
}

// Valida si ya existe un alumno con esa matrícula
function existeAlumnoPorMatricula(matricula, callback) {
  const sql = `
    SELECT matricula
    FROM alumno
    WHERE matricula = ?
    LIMIT 1
  `;

  connection.query(sql, [matricula], (err, result) => {
    if (err) return callback(err);
    callback(null, result && result.length > 0);
  });
}

function existeGrupoPorId(idgrupo, callback) {
  const sql = "SELECT idgrupo FROM grupo WHERE idgrupo = ? LIMIT 1";
  connection.query(sql, [idgrupo], (err, results) => {
    if (err) return callback(err, false);
    callback(null, results.length > 0);
  });
}

/* =========================================================
   ADMIN - LISTADO DE ALUMNOS
========================================================= */
app.get(
  "/api/admin/listado/alumnos",
  auth,
  requireRole("administrador"),
  (req, res) => {
    const sql = `
      SELECT
        a.matricula,
        u.nombre,
        u.email,
        u.telefono,
        g.grupo
      FROM alumno a
      INNER JOIN usuario u ON a.idusuario = u.idusuario
      LEFT JOIN grupo g ON a.idgrupo = g.idgrupo
      ORDER BY u.nombre ASC
    `;

    connection.query(sql, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtener alumnos" });
      }

      res.json(results);
    });
  },
);

/* =========================================================
   ADMIN - LISTADO DE TUTORES
========================================================= */
app.get(
  "/api/admin/listado/tutores",
  auth,
  requireRole("administrador"),
  (req, res) => {
    const sql = `
      SELECT
        t.idtutor,
        u.nombre,
        u.email,
        u.telefono,
        g.grupo
      FROM tutor t
      INNER JOIN usuario u ON t.idusuario = u.idusuario
      LEFT JOIN grupo g ON g.idtutor = t.idtutor
      ORDER BY u.nombre ASC
    `;

    connection.query(sql, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtener tutores" });
      }

      res.json(results);
    });
  },
);

/* =========================================================
   ADMIN - LISTADO DE RESPONSABLES
========================================================= */
app.get(
  "/api/admin/listado/responsables",
  auth,
  requireRole("administrador"),
  (req, res) => {
    const sql = `
      SELECT
        r.idresponsable,
        u.nombre,
        u.email,
        u.telefono,
        r.ubicacion
      FROM responsable r
      INNER JOIN usuario u ON r.idusuario = u.idusuario
      ORDER BY u.nombre ASC
    `;

    connection.query(sql, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtener responsables" });
      }

      res.json(results);
    });
  },
);

/* =========================================================
   ADMIN - LISTADO DE SUBDIRECTORES
   - Temporalmente salen los usuarios con rol Director
========================================================= */
app.get(
  "/api/admin/listado/subdirectores",
  auth,
  requireRole("administrador"),
  (req, res) => {
    const sql = `
      SELECT
        u.nombre,
        u.email,
        u.telefono
      FROM usuario u
      INNER JOIN rol r ON u.idRol = r.idRol
      WHERE LOWER(r.nombreRol) = 'director'
      ORDER BY u.nombre ASC
    `;

    connection.query(sql, (err, results) => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .json({ error: "Error al obtener subdirectores" });
      }

      res.json(results);
    });
  },
);

/* =========================================================
   ADMIN - REGISTRAR ALUMNO
========================================================= */
app.post(
  "/api/admin/registrar-alumno",
  auth,
  requireRole("administrador"),
  (req, res) => {
    const { matricula, idgrupo, nombre, email, telefono, password } = req.body;

    if (!matricula || !idgrupo || !nombre || !email || !telefono || !password) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    existeUsuarioPorEmail(email, (errEmail, existeEmail) => {
      if (errEmail) {
        console.error(errEmail);
        return res.status(500).json({ msg: "Error al validar email" });
      }

      if (existeEmail) {
        return res
          .status(400)
          .json({ msg: "Ya existe un usuario con ese correo" });
      }

      existeAlumnoPorMatricula(matricula, (errMat, existeMatricula) => {
        if (errMat) {
          console.error(errMat);
          return res.status(500).json({ msg: "Error al validar matrícula" });
        }

        if (existeMatricula) {
          return res
            .status(400)
            .json({ msg: "La matrícula ya está registrada" });
        }

        existeGrupoPorId(idgrupo, (errGrupo, existeGrupo) => {
          if (errGrupo) {
            console.error(errGrupo);
            return res.status(500).json({ msg: "Error al validar grupo" });
          }

          if (!existeGrupo) {
            return res
              .status(400)
              .json({ msg: "El grupo seleccionado no existe" });
          }

          obtenerIdRolPorNombre("Alumno", (errRol, idRolAlumno) => {
            if (errRol) {
              console.error(errRol);
              return res
                .status(500)
                .json({ msg: "No se encontró el rol Alumno" });
            }

            connection.beginTransaction((errTx) => {
              if (errTx) {
                console.error(errTx);
                return res
                  .status(500)
                  .json({ msg: "Error al iniciar transacción" });
              }

              const sqlUsuario = `
                INSERT INTO usuario (nombre, password, idRol, telefono, email)
                VALUES (?, ?, ?, ?, ?)
              `;

              connection.query(
                sqlUsuario,
                [nombre, password, idRolAlumno, telefono, email],
                (errUser, resultUser) => {
                  if (errUser) {
                    return connection.rollback(() => {
                      console.error(errUser);
                      res
                        .status(500)
                        .json({ msg: "Error al crear usuario del alumno" });
                    });
                  }

                  const idusuarioNuevo = resultUser.insertId;

                  const sqlAlumno = `
                    INSERT INTO alumno (matricula, idusuario, idgrupo)
                    VALUES (?, ?, ?)
                  `;

                  connection.query(
                    sqlAlumno,
                    [matricula, idusuarioNuevo, idgrupo],
                    (errAlumno) => {
                      if (errAlumno) {
                        return connection.rollback(() => {
                          console.error(errAlumno);
                          res
                            .status(500)
                            .json({ msg: "Error al crear alumno" });
                        });
                      }

                      connection.commit((errCommit) => {
                        if (errCommit) {
                          return connection.rollback(() => {
                            console.error(errCommit);
                            res
                              .status(500)
                              .json({ msg: "Error al confirmar transacción" });
                          });
                        }

                        res.json({
                          success: true,
                          msg: "Alumno registrado correctamente",
                        });
                      });
                    },
                  );
                },
              );
            });
          });
        });
      });
    });
  },
);

/* =========================================================
   ADMIN - REGISTRAR TUTOR
========================================================= */
app.post(
  "/api/admin/registrar-tutor",
  auth,
  requireRole("administrador"),
  (req, res) => {
    const { nombre, email, telefono, password } = req.body;

    if (!nombre || !email || !telefono || !password) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    existeUsuarioPorEmail(email, (errEmail, existeEmail) => {
      if (errEmail) {
        console.error(errEmail);
        return res.status(500).json({ msg: "Error al validar email" });
      }

      if (existeEmail) {
        return res
          .status(400)
          .json({ msg: "Ya existe un usuario con ese correo" });
      }

      obtenerIdRolPorNombre("Tutor", (errRol, idRolTutor) => {
        if (errRol) {
          console.error(errRol);
          return res.status(500).json({ msg: "No se encontró el rol Tutor" });
        }

        connection.beginTransaction((errTx) => {
          if (errTx) {
            console.error(errTx);
            return res
              .status(500)
              .json({ msg: "Error al iniciar transacción" });
          }

          const sqlUsuario = `
            INSERT INTO usuario (nombre, password, idRol, telefono, email)
            VALUES (?, ?, ?, ?, ?)
          `;

          connection.query(
            sqlUsuario,
            [nombre, password, idRolTutor, telefono, email],
            (errUser, resultUser) => {
              if (errUser) {
                return connection.rollback(() => {
                  console.error(errUser);
                  res
                    .status(500)
                    .json({ msg: "Error al crear usuario del tutor" });
                });
              }

              const idusuarioNuevo = resultUser.insertId;

              const sqlTutor = `
                INSERT INTO tutor (idusuario)
                VALUES (?)
              `;

              connection.query(sqlTutor, [idusuarioNuevo], (errTutor) => {
                if (errTutor) {
                  return connection.rollback(() => {
                    console.error(errTutor);
                    res.status(500).json({ msg: "Error al crear tutor" });
                  });
                }

                connection.commit((errCommit) => {
                  if (errCommit) {
                    return connection.rollback(() => {
                      console.error(errCommit);
                      res.status(500).json({
                        msg: "Error al confirmar transacción",
                      });
                    });
                  }

                  res.json({
                    success: true,
                    msg: "Tutor registrado correctamente",
                  });
                });
              });
            },
          );
        });
      });
    });
  },
);

/* =========================================================
   ADMIN - REGISTRAR RESPONSABLE
========================================================= */
app.post(
  "/api/admin/registrar-responsable",
  auth,
  requireRole("administrador"),
  (req, res) => {
    const { nombre, email, telefono, password } = req.body;

    if (!nombre || !email || !telefono || !password) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    existeUsuarioPorEmail(email, (errEmail, existeEmail) => {
      if (errEmail) {
        console.error(errEmail);
        return res.status(500).json({ msg: "Error al validar email" });
      }

      if (existeEmail) {
        return res
          .status(400)
          .json({ msg: "Ya existe un usuario con ese correo" });
      }

      obtenerIdRolPorNombre("Responsable", (errRol, idRolResponsable) => {
        if (errRol) {
          console.error(errRol);
          return res
            .status(500)
            .json({ msg: "No se encontró el rol Responsable" });
        }

        connection.beginTransaction((errTx) => {
          if (errTx) {
            console.error(errTx);
            return res
              .status(500)
              .json({ msg: "Error al iniciar transacción" });
          }

          const sqlUsuario = `
            INSERT INTO usuario (nombre, password, idRol, telefono, email)
            VALUES (?, ?, ?, ?, ?)
          `;

          connection.query(
            sqlUsuario,
            [nombre, password, idRolResponsable, telefono, email],
            (errUser, resultUser) => {
              if (errUser) {
                return connection.rollback(() => {
                  console.error(errUser);
                  res
                    .status(500)
                    .json({ msg: "Error al crear usuario del responsable" });
                });
              }

              const idusuarioNuevo = resultUser.insertId;

              const sqlResponsable = `
                INSERT INTO responsable (idusuario, ubicacion)
                VALUES (?, ?)
              `;

              connection.query(
                sqlResponsable,
                [idusuarioNuevo, "No especificada"],
                (errResp) => {
                  if (errResp) {
                    return connection.rollback(() => {
                      console.error(errResp);
                      res
                        .status(500)
                        .json({ msg: "Error al crear responsable" });
                    });
                  }

                  connection.commit((errCommit) => {
                    if (errCommit) {
                      return connection.rollback(() => {
                        console.error(errCommit);
                        res
                          .status(500)
                          .json({ msg: "Error al confirmar transacción" });
                      });
                    }

                    res.json({
                      success: true,
                      msg: "Responsable registrado correctamente",
                    });
                  });
                },
              );
            },
          );
        });
      });
    });
  },
);

/* =========================================================
   ADMIN - REGISTRAR SUBDIRECTOR
   - En sistema se guardará temporalmente como Director
========================================================= */
app.post(
  "/api/admin/registrar-subdirector",
  auth,
  requireRole("administrador"),
  (req, res) => {
    const { nombre, email, telefono, password } = req.body;

    if (!nombre || !email || !telefono || !password) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    existeUsuarioPorEmail(email, (errEmail, existeEmail) => {
      if (errEmail) {
        console.error(errEmail);
        return res.status(500).json({ msg: "Error al validar email" });
      }

      if (existeEmail) {
        return res
          .status(400)
          .json({ msg: "Ya existe un usuario con ese correo" });
      }

      obtenerIdRolPorNombre("Director", (errRol, idRolDirector) => {
        if (errRol) {
          console.error(errRol);
          return res.status(500).json({
            msg: "No se encontró el rol Director para guardar el subdirector",
          });
        }

        const sqlUsuario = `
          INSERT INTO usuario (nombre, password, idRol, telefono, email)
          VALUES (?, ?, ?, ?, ?)
        `;

        connection.query(
          sqlUsuario,
          [nombre, password, idRolDirector, telefono, email],
          (errUser) => {
            if (errUser) {
              console.error(errUser);
              return res
                .status(500)
                .json({ msg: "Error al crear subdirector" });
            }

            res.json({
              success: true,
              msg: "Subdirector registrado correctamente (guardado como Director)",
            });
          },
        );
      });
    });
  },
);

/* =========================================================
   GET - OBTENER TODOS LOS GRUPOS PARA ADMIN
   - Incluye datos del grupo
   - Tutor asignado si existe
   - Fechas del servicio
========================================================= */
app.get("/api/admin/grupos", auth, requireRole("administrador"), (req, res) => {
  const sql = `
    SELECT
      g.idgrupo,
      g.grupo,
      g.turno,
      g.cuatrimestre,
      g.idtutor,
      g.fecha_inicio_servicio,
      g.fecha_termino_servicio,
      u.nombre AS nombre_tutor
    FROM grupo g
    LEFT JOIN tutor t ON g.idtutor = t.idtutor
    LEFT JOIN usuario u ON t.idusuario = u.idusuario
    ORDER BY g.idgrupo ASC
  `;

  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Error al obtener grupos para admin:", err);
      return res.status(500).json({ error: "Error al obtener grupos" });
    }

    res.json(results);
  });
});

/* =========================================================
   GET - OBTENER TUTORES
   - Se usa para llenar el select del modal de grupos
========================================================= */
app.get(
  "/api/admin/tutores",
  auth,
  requireRole("administrador"),
  (req, res) => {
    const sql = `
      SELECT
        t.idtutor,
        u.idusuario,
        u.nombre,
        u.email,
        u.telefono
      FROM tutor t
      INNER JOIN usuario u ON t.idusuario = u.idusuario
      ORDER BY u.nombre ASC
    `;

    connection.query(sql, (err, results) => {
      if (err) {
        console.error("Error al obtener tutores para admin:", err);
        return res.status(500).json({ error: "Error al obtener tutores" });
      }

      res.json(results);
    });
  },
);

/* =========================================================
   PUT - ACTUALIZAR CONFIGURACIÓN DE UN GRUPO
   - Permite:
     * asignar o cambiar tutor
     * definir fecha_inicio_servicio
     * definir fecha_termino_servicio
========================================================= */
app.put(
  "/api/admin/grupos/:id",
  auth,
  requireRole("administrador"),
  (req, res) => {
    const { id } = req.params;
    let { idtutor, fecha_inicio_servicio, fecha_termino_servicio } = req.body;

    const idgrupo = Number(id);

    if (!idgrupo) {
      return res.status(400).json({ msg: "ID de grupo inválido" });
    }

    if (idtutor === "" || idtutor === undefined) {
      idtutor = null;
    } else if (idtutor !== null) {
      idtutor = Number(idtutor);
    }

    if (fecha_inicio_servicio === "") fecha_inicio_servicio = null;
    if (fecha_termino_servicio === "") fecha_termino_servicio = null;

    if (
      fecha_inicio_servicio &&
      fecha_termino_servicio &&
      fecha_termino_servicio < fecha_inicio_servicio
    ) {
      return res.status(400).json({
        msg: "La fecha de término no puede ser menor que la fecha de inicio",
      });
    }

    const sqlGrupo = `
      SELECT idgrupo
      FROM grupo
      WHERE idgrupo = ?
      LIMIT 1
    `;

    connection.query(sqlGrupo, [idgrupo], (errGrupo, resultGrupo) => {
      if (errGrupo) {
        console.error(errGrupo);
        return res.status(500).json({ msg: "Error al validar grupo" });
      }

      if (!resultGrupo || resultGrupo.length === 0) {
        return res.status(404).json({ msg: "Grupo no encontrado" });
      }

      if (idtutor !== null) {
        const sqlTutor = `
          SELECT idtutor
          FROM tutor
          WHERE idtutor = ?
          LIMIT 1
        `;

        connection.query(sqlTutor, [idtutor], (errTutor, resultTutor) => {
          if (errTutor) {
            console.error(errTutor);
            return res.status(500).json({ msg: "Error al validar tutor" });
          }

          if (!resultTutor || resultTutor.length === 0) {
            return res.status(404).json({ msg: "Tutor no encontrado" });
          }

          actualizarGrupo();
        });
      } else {
        actualizarGrupo();
      }

      function actualizarGrupo() {
        const sqlUpdate = `
          UPDATE grupo
          SET
            idtutor = ?,
            fecha_inicio_servicio = ?,
            fecha_termino_servicio = ?
          WHERE idgrupo = ?
        `;

        connection.query(
          sqlUpdate,
          [idtutor, fecha_inicio_servicio, fecha_termino_servicio, idgrupo],
          (errUpdate, resultUpdate) => {
            if (errUpdate) {
              console.error(errUpdate);
              return res.status(500).json({ msg: "Error al actualizar grupo" });
            }

            if (resultUpdate.affectedRows === 0) {
              return res.status(404).json({ msg: "Grupo no encontrado" });
            }

            return res.json({
              success: true,
              msg: "Grupo actualizado correctamente",
            });
          },
        );
      }
    });
  },
);

/* =========================================================
   CONSULTA GENERAL DE GRUPOS
   - Director ve todos los grupos
   - Tutor solo ve los grupos que le pertenecen
========================================================= */
app.get("/api/grupos", auth, requireRole("director", "tutor"), (req, res) => {
  const { rol, idusuario } = req.user;

  let filtroSQL = "";
  let parametros = [];

  if (rol.toLowerCase() === "tutor") {
    filtroSQL = "WHERE t.idusuario = ?";
    parametros.push(idusuario);
  }

  const sql = `
    SELECT 
      g.idgrupo, 
      g.grupo,
      g.turno,
      g.cuatrimestre,
      u.nombre AS tutor,
      COUNT(DISTINCT a.matricula) AS total_alumnos,
      IFNULL(SUM(CASE WHEN sub.total_horas >= 480 THEN 1 ELSE 0 END), 0) AS completados,
      IFNULL(SUM(CASE WHEN sub.total_horas < 480 OR sub.total_horas IS NULL THEN 1 ELSE 0 END), 0) AS no_completados
    FROM grupo g
    LEFT JOIN tutor t ON g.idtutor = t.idtutor
    LEFT JOIN usuario u ON t.idusuario = u.idusuario
    LEFT JOIN alumno a ON g.idgrupo = a.idgrupo
    LEFT JOIN (
      SELECT aa.matricula, SUM(ta.horas_Tareas) AS total_horas
      FROM asignacion_actividad aa
      JOIN tareas_actividad ta ON aa.idactividad = ta.idactividad
      GROUP BY aa.matricula
    ) sub ON a.matricula = sub.matricula
    ${filtroSQL}
    GROUP BY g.idgrupo, g.grupo, g.turno, g.cuatrimestre, u.nombre
    ORDER BY g.idgrupo ASC
  `;

  connection.query(sql, parametros, (err, results) => {
    if (err) {
      console.error("Error en SQL:", err);
      return res.status(500).json({ error: "Error en DB" });
    }

    res.json(results);
  });
});

/* =========================================================
   CONSULTA FILTRADA DE ALUMNOS POR GRUPO
   - Recibe el id del grupo por query string
   - Además agrega las actividades de cada alumno
========================================================= */
/* =========================================================
   CONSULTA FILTRADA DE ALUMNOS POR GRUPO
   - Recibe el id del grupo por query string
   - Además agrega las actividades de cada alumno
========================================================= */
app.get("/api/alumnos-grupo", auth, (req, res) => {
  const idgrupo = req.query.id;

  if (!idgrupo) {
    return res.status(400).json({ error: "Falta el id del grupo" });
  }

  const sql = `
    SELECT 
      a.matricula,
      u.nombre,
      u.email,
      u.telefono,
      a.foto_perfil,
      g.grupo,
      IFNULL(sub.total_horas, 0) AS horas_liberadas
    FROM alumno a
    JOIN usuario u ON a.idusuario = u.idusuario
    JOIN grupo g ON a.idgrupo = g.idgrupo
    LEFT JOIN (
      SELECT 
        aa.matricula,
        IFNULL(SUM(
          CASE
            WHEN ct.estatus = 'Cumplida' THEN ta.horas_Tareas
            ELSE 0
          END
        ), 0) AS total_horas
      FROM asignacion_actividad aa
      LEFT JOIN cumplimientotarea ct
        ON ct.idAsignacionActividad = aa.idasignacion_actividad
      LEFT JOIN tareas_actividad ta
        ON ta.idTareas_Actividad = ct.idTareasActividad
      GROUP BY aa.matricula
    ) sub ON a.matricula = sub.matricula
    WHERE a.idgrupo = ?
    ORDER BY u.nombre ASC
  `;

  connection.query(sql, [idgrupo], async (err, results) => {
    if (err) {
      console.error("Error al obtener alumnos del grupo:", err);
      return res.status(500).json({ error: err.message });
    }

    try {
      const alumnosConActividades = await Promise.all(
        results.map((alumno) => {
          return new Promise((resolve, reject) => {
            const sqlActividades = `
              SELECT 
                act.idactividad,
                act.nombreActividad AS actividad,
                act.horas_actividad,
                IFNULL(SUM(
                  CASE
                    WHEN ct.estatus = 'Cumplida' THEN ta.horas_Tareas
                    ELSE 0
                  END
                ), 0) AS horas_cumplidas
              FROM asignacion_actividad aa
              JOIN actividad act
                ON aa.idactividad = act.idactividad
              LEFT JOIN cumplimientotarea ct
                ON ct.idAsignacionActividad = aa.idasignacion_actividad
              LEFT JOIN tareas_actividad ta
                ON ta.idTareas_Actividad = ct.idTareasActividad
              WHERE aa.matricula = ?
              GROUP BY act.idactividad, act.nombreActividad, act.horas_actividad
              ORDER BY act.nombreActividad ASC
            `;

            connection.query(
              sqlActividades,
              [alumno.matricula],
              (errActs, acts) => {
                if (errActs) {
                  console.error(
                    "Error al obtener actividades del alumno:",
                    errActs,
                  );
                  return reject(errActs);
                }

                const actividades = acts.map((a) => {
                  const horasCumplidas = Number(a.horas_cumplidas) || 0;
                  const horasProyecto = Number(a.horas_actividad) || 0;

                  return {
                    nombre: a.actividad,
                    horas: horasCumplidas,
                    estatus:
                      horasProyecto > 0 && horasCumplidas >= horasProyecto
                        ? "completada"
                        : "en proceso",
                  };
                });

                resolve({
                  ...alumno,
                  actividades,
                });
              },
            );
          });
        }),
      );

      res.json(alumnosConActividades);
    } catch (error) {
      console.error("Error procesando actividades:", error);
      res.status(500).json({ error: "Error procesando actividades" });
    }
  });
});

/* =========================
   LOGIN 
========================= */

// Ruta POST para iniciar sesión
app.post("/api/login", (req, res) => {
  // Se obtienen email y password enviados por el frontend
  const { email, password } = req.body;

  // Validación básica: si falta uno de los dos, se responde con error
  if (!email || !password) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  // Consulta que busca al usuario y también trae el nombre del rol
  const sql = `
    SELECT u.idusuario, u.nombre, r.nombreRol 
    FROM usuario u
    INNER JOIN rol r ON u.idRol = r.idRol
    WHERE u.email = ? AND u.password = ?
  `;

  // Se ejecuta la consulta usando email y password como parámetros
  connection.query(sql, [email, password], (err, results) => {
    // Si hay error en la BD
    if (err) {
      console.error("Error en BD:", err);
      return res.status(500).json({ error: "Error en BD" });
    }

    // Si no se encontró ningún usuario, el correo o contraseña son incorrectos
    if (!results || results.length === 0) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    // Si sí encontró, se toma el primer usuario
    const user = results[0];

    // Validación extra por seguridad
    if (!user.idusuario || !user.nombre || !user.nombreRol) {
      console.error("Datos incompletos del usuario:", user);
      return res.status(500).json({ error: "Error en datos del usuario" });
    }

    // Se normaliza el nombre y rol a minúsculas
    const nombreUsuario = user.nombre.toLowerCase();
    const nombreRol = user.nombreRol.toLowerCase();

    // Se crea el token JWT con los datos necesarios
    const token = jwt.sign(
      {
        idusuario: user.idusuario,
        nombre: user.nombre,
        rol: nombreRol,
      },
      JWT_SECRET,
      { expiresIn: "8h" },
    );

    // Se responde con el token y datos útiles para el frontend
    res.json({
      token,
      usuario: nombreUsuario,
      rol: nombreRol,
      idusuario: user.idusuario,
    });
  });
});

/* =========================
  Perfiles de responsables
========================= */

// Ruta GET para obtener el perfil del responsable logueado
app.get("/api/responsable/perfil", auth, (req, res) => {
  // Se toma el idusuario desde el token validado
  const idUsuario = req.user.idusuario;

  // Consulta para obtener nombre, email, teléfono y ubicación del responsable
  const sql = `
    SELECT 
      u.nombre,
      u.email,
      u.telefono, 
      r.ubicacion
    FROM usuario u
    JOIN responsable r ON u.idusuario = r.idusuario
    WHERE u.idusuario = ?
  `;

  connection.query(sql, [idUsuario], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtener perfil" });
    }

    // Se devuelve el primer resultado, porque solo debe existir un perfil por usuario
    res.json(results[0]);
  });
});

// Ruta PUT para actualizar teléfono y opcionalmente contraseña del responsable
app.put("/api/responsable/perfil", auth, async (req, res) => {
  const idUsuario = req.user.idusuario;
  const { telefono, password } = req.body;

  try {
    // Se requiere bcrypt para cifrar contraseñas
    const bcrypt = require("bcrypt");

    // Se empieza construyendo el SQL para actualizar el teléfono
    let sql = "UPDATE usuario SET telefono = ?";
    let values = [telefono];

    // Si sí enviaron password, se cifra y también se agrega al UPDATE
    if (password && password.trim() !== "") {
      const hash = await bcrypt.hash(password, 10);
      sql += ", password = ?";
      values.push(hash);
    }

    // Se completa el SQL con el WHERE del usuario actual
    sql += " WHERE idusuario = ?";
    values.push(idUsuario);

    // Se ejecuta el UPDATE
    connection.query(sql, values, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al actualizar usuario" });
      }

      res.json({ message: "Perfil actualizado correctamente" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error servidor" });
  }
});

/* =========================
   PERFIL DE ALUMNO
========================= */

// Ruta GET para obtener perfil del alumno logueado
app.get("/api/alumno/perfil", auth, (req, res) => {
  const idUsuario = req.user.idusuario;

  const sql = `
    SELECT 
      u.nombre,
      u.email,
      u.telefono,
      g.grupo,
      a.matricula,
      a.idgrupo,
      a.foto_perfil,
      g.fecha_inicio_servicio,
      g.fecha_termino_servicio
    FROM usuario u
    JOIN alumno a ON u.idusuario = a.idusuario
    LEFT JOIN grupo g ON a.idgrupo = g.idgrupo
    WHERE u.idusuario = ?
  `;

  connection.query(sql, [idUsuario], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtener perfil" });
    }

    res.json(results[0]);
  });
});

// Ruta PUT para actualizar teléfono y contraseña del alumno
app.put("/api/alumno/perfil", auth, async (req, res) => {
  const idUsuario = req.user.idusuario;
  const { telefono, password } = req.body;

  try {
    const bcrypt = require("bcrypt");

    let sql = "UPDATE usuario SET telefono = ?";
    let values = [telefono];

    if (password && password.trim() !== "") {
      const hash = await bcrypt.hash(password, 10);
      sql += ", password = ?";
      values.push(hash);
    }

    sql += " WHERE idusuario = ?";
    values.push(idUsuario);

    connection.query(sql, values, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al actualizar usuario" });
      }

      res.json({ message: "Perfil de alumno actualizado" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error servidor" });
  }
});

// Ruta PUT para subir/actualizar foto de perfil del alumno
app.put(
  "/api/alumno/perfil/foto",
  auth,
  uploadFotoAlumno.single("foto"),
  (req, res) => {
    const idUsuario = req.user.idusuario;

    if (!req.file) {
      return res.status(400).json({ error: "No se recibió ninguna imagen" });
    }

    const rutaNueva = `/uploads/alumnos/${req.file.filename}`;

    const sqlBuscarFotoAnterior = `
      SELECT foto_perfil
      FROM alumno
      WHERE idusuario = ?
      LIMIT 1
    `;

    connection.query(
      sqlBuscarFotoAnterior,
      [idUsuario],
      (errBuscar, results) => {
        if (errBuscar) {
          console.error(errBuscar);
          return res
            .status(500)
            .json({ error: "Error al buscar foto anterior" });
        }

        const fotoAnterior = results?.[0]?.foto_perfil || null;

        if (fotoAnterior) {
          const rutaArchivoAnterior = path.join(
            __dirname,
            fotoAnterior.replace(/^\//, ""),
          );

          if (fs.existsSync(rutaArchivoAnterior)) {
            try {
              fs.unlinkSync(rutaArchivoAnterior);
            } catch (errorBorrar) {
              console.error("Error al borrar foto anterior:", errorBorrar);
            }
          }
        }

        const sqlActualizarFoto = `
        UPDATE alumno
        SET foto_perfil = ?
        WHERE idusuario = ?
      `;

        connection.query(
          sqlActualizarFoto,
          [rutaNueva, idUsuario],
          (errUpdate, result) => {
            if (errUpdate) {
              console.error(errUpdate);
              return res
                .status(500)
                .json({ error: "Error al guardar foto de perfil" });
            }

            if (result.affectedRows === 0) {
              return res.status(404).json({ error: "Alumno no encontrado" });
            }

            res.json({
              message: "Foto de perfil actualizada correctamente",
              foto_perfil: rutaNueva,
            });
          },
        );
      },
    );
  },
);

/* =========================
   PERFIL DE TUTOR
========================= */

// Ruta GET para obtener el perfil del tutor logueado
app.get("/api/tutor/perfil", auth, (req, res) => {
  const idUsuario = req.user.idusuario;

  // Consulta para traer nombre, email, teléfono, grupo asignado e id del tutor
  const sql = `
    SELECT 
      u.nombre,
      u.email,
      u.telefono,
      g.grupo,
      g.idgrupo,
      t.idtutor
    FROM usuario u
    JOIN tutor t ON u.idusuario = t.idusuario
    LEFT JOIN grupo g ON g.idtutor = t.idtutor
    WHERE u.idusuario = ?
  `;

  connection.query(sql, [idUsuario], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtener perfil" });
    }

    res.json(results[0]);
  });
});

// Ruta PUT para actualizar teléfono y contraseña del tutor
app.put("/api/tutor/perfil", auth, async (req, res) => {
  const idUsuario = req.user.idusuario;
  const { telefono, password } = req.body;

  try {
    const bcrypt = require("bcrypt");

    let sql = "UPDATE usuario SET telefono = ?";
    let values = [telefono];

    if (password && password.trim() !== "") {
      const hash = await bcrypt.hash(password, 10);
      sql += ", password = ?";
      values.push(hash);
    }

    sql += " WHERE idusuario = ?";
    values.push(idUsuario);

    connection.query(sql, values, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al actualizar usuario" });
      }

      res.json({ message: "Perfil de tutor actualizado" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error servidor" });
  }
});

/* =========================
   Mostrar los grupos que no tiene tutor para que el tutor en su registro, escoga su grupo que se le asigno
========================= */

// Ruta GET que devuelve los grupos que todavía no tienen tutor asignado
app.get("/api/grupos-disponibles", (req, res) => {
  const sql =
    "SELECT idgrupo, grupo, cuatrimestre FROM grupo WHERE idtutor IS NULL";

  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json([]);
    res.json(results);
  });
});

/* =========================
   API EXTERNA - FERIADOS
   Usa Nager.Date para consultar días festivos de México
========================= */

async function obtenerFeriadosMX(anio) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${anio}/MX`;

  const respuesta = await fetch(url);

  if (!respuesta.ok) {
    throw new Error(`No se pudieron obtener feriados del año ${anio}`);
  }

  const data = await respuesta.json();

  return Array.isArray(data) ? data : [];
}

async function obtenerMapaFeriadosDeAnios(anios) {
  const mapa = new Map();

  for (const anio of anios) {
    const feriados = await obtenerFeriadosMX(anio);

    feriados.forEach((f) => {
      if (f?.date) {
        mapa.set(f.date, f.localName || f.name || "Día festivo");
      }
    });
  }

  return mapa;
}

function obtenerAniosDeFechas(...fechas) {
  return [
    ...new Set(
      fechas.filter(Boolean).map((fecha) => String(fecha).split("-")[0]),
    ),
  ];
}

async function validarFechasNoFeriadas(...fechas) {
  const anios = obtenerAniosDeFechas(...fechas);
  const mapaFeriados = await obtenerMapaFeriadosDeAnios(anios);

  for (const fecha of fechas) {
    if (fecha && mapaFeriados.has(fecha)) {
      return {
        esValida: false,
        fecha,
        nombreFeriado: mapaFeriados.get(fecha),
      };
    }
  }

  return { esValida: true };
}

/* =========================
   CRUD ACTIVIDADES 
========================= */

/* =========================
   OBTENER ACTIVIDADES
   - Responsable: ve SUS actividades (todas)
   - Director/Tutor: ven todas menos pendientes
   - Alumno: solo activas
   - También incluye inscritos e inscrito
========================= */
app.get("/api/actividad", auth, (req, res) => {
  const rolLogueado = req.user.rol.toLowerCase();
  const idUsuarioLogueado = req.user.idusuario;

  function ejecutarQueryPrincipal(idResponsable = null) {
    let sql = `
      SELECT 
        a.*,
        u.nombre AS nombre_responsable,

        (
          SELECT COUNT(*) 
          FROM asignacion_actividad aa 
          WHERE aa.idactividad = a.idactividad
        ) AS inscritos,

        (
          SELECT COUNT(*) 
          FROM asignacion_actividad aa
          INNER JOIN alumno al ON aa.matricula = al.matricula
          WHERE aa.idactividad = a.idactividad
          AND al.idusuario = ?
        ) AS inscrito,

        (
          SELECT IFNULL(SUM(
            CASE
              WHEN ct.estatus = 'Cumplida' THEN ta.horas_Tareas
              ELSE 0
            END
          ), 0)
          FROM asignacion_actividad aa
          LEFT JOIN cumplimientotarea ct
            ON ct.idAsignacionActividad = aa.idasignacion_actividad
          LEFT JOIN tareas_actividad ta
            ON ta.idTareas_Actividad = ct.idTareasActividad
          WHERE aa.idactividad = a.idactividad
        ) AS horas_cumplidas

      FROM actividad a
      INNER JOIN responsable r ON a.idresponsable = r.idresponsable
      INNER JOIN usuario u ON r.idusuario = u.idusuario
      WHERE 1=1
    `;

    let params = [idUsuarioLogueado];

    if (rolLogueado === "responsable") {
      sql += ` AND a.idresponsable = ? `;
      params.push(idResponsable);
    } else if (rolLogueado === "director" || rolLogueado === "tutor") {
      sql += ` AND a.estatus != 'Pendiente' `;
    } else if (rolLogueado === "alumno") {
      sql += `
        AND a.estatus = 'Activa'
        AND a.fecha_alta >= (
          SELECT g.fecha_inicio_servicio
          FROM alumno al
          INNER JOIN grupo g ON al.idgrupo = g.idgrupo
          WHERE al.idusuario = ?
          LIMIT 1
        )
        AND a.fechaTermino <= (
          SELECT g.fecha_termino_servicio
          FROM alumno al
          INNER JOIN grupo g ON al.idgrupo = g.idgrupo
          WHERE al.idusuario = ?
          LIMIT 1
        )
      `;
      params.push(idUsuarioLogueado, idUsuarioLogueado);
    }

    sql += `
      ORDER BY 
        CASE 
          WHEN a.estatus = 'Activa' THEN 1
          WHEN a.estatus = 'Finalizada' THEN 2
          WHEN a.estatus = 'Cancelada' THEN 3
          ELSE 4
        END,
        a.fecha_alta DESC
    `;

    connection.query(sql, params, (err, result) => {
      if (err) {
        console.error("❌ Error al obtener actividades:", err);
        return res.status(500).json({ msg: "Error al obtener actividades" });
      }

      const actividadesProcesadas = result.map((act) => {
        const horasProyecto = Number(act.horas_actividad || 0);
        const horasCumplidas = Number(act.horas_cumplidas || 0);

        let porcentaje_avance = 0;

        if (act.estatus === "Pendiente") {
          porcentaje_avance = 0;
        } else if (act.estatus === "Finalizada") {
          porcentaje_avance = 100;
        } else {
          porcentaje_avance =
            horasProyecto > 0
              ? Math.min(
                  100,
                  Math.round((horasCumplidas / horasProyecto) * 100),
                )
              : 0;
        }

        return {
          ...act,
          horas_cumplidas: horasCumplidas,
          porcentaje_avance,
        };
      });

      res.json(actividadesProcesadas);
    });
  }

  if (rolLogueado === "responsable") {
    const sqlResponsable = `
      SELECT idresponsable 
      FROM responsable 
      WHERE idusuario = ?
    `;

    connection.query(
      sqlResponsable,
      [idUsuarioLogueado],
      (errResp, resultResp) => {
        if (errResp) {
          console.error("Error al obtener responsable:", errResp);
          return res.status(500).json({ msg: "Error al obtener responsable" });
        }

        if (resultResp.length === 0) {
          return res.status(404).json({ msg: "Responsable no encontrado" });
        }

        const idResponsable = resultResp[0].idresponsable;
        ejecutarQueryPrincipal(idResponsable);
      },
    );
  } else if (rolLogueado === "alumno") {
    const sqlValidarPeriodoAlumno = `
      SELECT 
        g.fecha_inicio_servicio,
        g.fecha_termino_servicio
      FROM alumno al
      INNER JOIN grupo g ON al.idgrupo = g.idgrupo
      WHERE al.idusuario = ?
      LIMIT 1
    `;

    connection.query(
      sqlValidarPeriodoAlumno,
      [idUsuarioLogueado],
      (errPeriodo, resultPeriodo) => {
        if (errPeriodo) {
          console.error("Error al validar periodo del alumno:", errPeriodo);
          return res
            .status(500)
            .json({ msg: "Error al validar el periodo del alumno" });
        }

        if (resultPeriodo.length === 0) {
          return res
            .status(404)
            .json({ msg: "No se encontró el grupo del alumno" });
        }

        const fechaInicio = resultPeriodo[0].fecha_inicio_servicio;
        const fechaTermino = resultPeriodo[0].fecha_termino_servicio;

        if (!fechaInicio || !fechaTermino) {
          return res.status(200).json({
            sinPeriodo: true,
            msg: "Tu grupo aún no tiene definido su periodo de servicio social.",
            data: [],
          });
        }

        ejecutarQueryPrincipal();
      },
    );
  } else {
    ejecutarQueryPrincipal();
  }
});

// CREAR ACTIVIDAD
app.post(
  "/api/actividad",
  auth,
  requireRole("responsable"),
  async (req, res) => {
    const {
      nombreActividad,
      descripcion,
      horas_actividad,
      fecha_alta,
      fechaTermino,
      totalAlumnosRequeridos,
    } = req.body;

    const idUsuario = req.user.idusuario;

    if (
      !nombreActividad ||
      !descripcion ||
      !horas_actividad ||
      !fecha_alta ||
      !fechaTermino ||
      !totalAlumnosRequeridos
    ) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    if (fechaTermino < fecha_alta) {
      return res.status(400).json({
        msg: "La fecha de término no puede ser menor que la fecha de inicio",
      });
    }

    try {
      const validacionFeriados = await validarFechasNoFeriadas(
        fecha_alta,
        fechaTermino,
      );

      if (!validacionFeriados.esValida) {
        return res.status(400).json({
          msg: `No se puede guardar el proyecto: la fecha ${validacionFeriados.fecha} es día festivo (${validacionFeriados.nombreFeriado}).`,
        });
      }

      const sqlResponsable = `
      SELECT idresponsable 
      FROM responsable 
      WHERE idusuario = ?
    `;

      connection.query(sqlResponsable, [idUsuario], (err, resultResp) => {
        if (err || resultResp.length === 0) {
          console.error(err);
          return res.status(500).json({ msg: "Responsable no encontrado" });
        }

        const idResponsable = resultResp[0].idresponsable;

        const sqlInsert = `
        INSERT INTO actividad 
        (nombreActividad, descripcion, horas_actividad, fecha_alta, fechaTermino, totalAlumnosRequeridos, idresponsable, estatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente')
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
            idResponsable,
          ],
          (err2) => {
            if (err2) {
              console.log("Error SQL:", err2);
              return res.status(500).json({ msg: "Error al crear actividad" });
            }

            res.json({ success: true, msg: "Actividad creada correctamente" });
          },
        );
      });
    } catch (error) {
      console.error("Error al validar feriados en actividad:", error);
      return res.status(500).json({
        msg: "Error al validar días festivos para la actividad",
      });
    }
  },
);

// EDITAR ACTIVIDAD
app.put(
  "/api/actividad/:id",
  auth,
  requireRole("responsable"),
  async (req, res) => {
    const { id } = req.params;

    const {
      nombreActividad,
      descripcion,
      horas_actividad,
      fecha_alta,
      fechaTermino,
      totalAlumnosRequeridos,
      estatus,
    } = req.body;

    const idUsuario = req.user.idusuario;

    if (
      !nombreActividad ||
      !descripcion ||
      !horas_actividad ||
      !fecha_alta ||
      !fechaTermino ||
      !totalAlumnosRequeridos ||
      !estatus
    ) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    if (fechaTermino < fecha_alta) {
      return res.status(400).json({
        msg: "La fecha de término no puede ser menor que la fecha de inicio",
      });
    }

    try {
      const validacionFeriados = await validarFechasNoFeriadas(
        fecha_alta,
        fechaTermino,
      );

      if (!validacionFeriados.esValida) {
        return res.status(400).json({
          msg: `No se puede actualizar el proyecto: la fecha ${validacionFeriados.fecha} es día festivo (${validacionFeriados.nombreFeriado}).`,
        });
      }

      const sqlResponsable = `
      SELECT idresponsable 
      FROM responsable 
      WHERE idusuario = ?
    `;

      connection.query(sqlResponsable, [idUsuario], (err, resultResp) => {
        if (err || resultResp.length === 0) {
          return res.status(500).json({ msg: "Responsable no encontrado" });
        }

        const idResponsable = resultResp[0].idresponsable;

        const sql = `
        UPDATE actividad 
        SET 
          nombreActividad = ?,
          descripcion = ?,
          horas_actividad = ?,
          fecha_alta = ?,
          fechaTermino = ?,
          totalAlumnosRequeridos = ?,
          estatus = ?
        WHERE idactividad = ? 
        AND idresponsable = ?
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
            estatus,
            id,
            idResponsable,
          ],
          (err2, result) => {
            if (err2) {
              console.error(err2);
              return res
                .status(500)
                .json({ msg: "Error al actualizar actividad" });
            }

            if (result.affectedRows === 0) {
              return res.status(403).json({
                msg: "No tienes permiso para editar esta actividad",
              });
            }

            res.json({ success: true });
          },
        );
      });
    } catch (error) {
      console.error("Error al validar feriados al editar actividad:", error);
      return res.status(500).json({
        msg: "Error al validar días festivos para la actividad",
      });
    }
  },
);

// CANCELAR ACTIVIDAD
app.delete(
  "/api/actividad/:id",
  auth,
  requireRole("responsable"),
  (req, res) => {
    const { id } = req.params;

    // En vez de eliminar de verdad, solo cambia el estatus a Cancelada
    const sql =
      "UPDATE actividad SET estatus = 'Cancelada' WHERE idactividad = ?";

    connection.query(sql, [id], (err) => {
      if (err) return res.status(500).json({ error: "Error al cancelar" });
      res.json({ success: true, msg: "Actividad cancelada" });
    });
  },
);

/* =========================
   RESPONSABLES 
========================= */

// Ruta para obtener la lista de responsables
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

// Ruta para obtener el responsable de una actividad específica
app.get("/responsable/:idActividad", auth, (req, res) => {
  const { idActividad } = req.params;

  const sql = `
    SELECT 
      u.nombre,
      u.telefono,
      r.ubicacion
    FROM actividad a
    JOIN responsable r ON a.idresponsable = r.idresponsable
    JOIN usuario u ON r.idusuario = u.idusuario
    WHERE a.idactividad = ?
  `;

  connection.query(sql, [idActividad], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error en servidor" });
    }

    res.json(results[0]);
  });
});

/* =========================
   ALUMNOS 
========================= */

// Ruta para obtener alumnos, y si es tutor, filtrarlos por sus grupos
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

  // Si el rol es tutor, se agrega el filtro
  if (req.user.rol.toLowerCase() === "tutor") {
    sql += `
      INNER JOIN tutor t ON g.idtutor = t.idtutor
      WHERE t.idusuario = ?
    `;
  }

  sql += " GROUP BY a.matricula";

  // Parámetros del query si el rol es tutor
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
   Ahora usa:
   - fechaInicio
   - fechaFin
========================= */

// OBTENER TAREAS
app.get("/api/tareas/:idactividad", auth, (req, res) => {
  const { idactividad } = req.params;
  const idUsuario = req.user?.idusuario;
  const rol = req.user?.rol?.toLowerCase();

  if (!rol) {
    return res.status(401).json({ error: "Usuario no autenticado" });
  }

  // Si no es alumno, solo se listan las tareas de la actividad
  if (rol !== "alumno") {
    const sql = `
      SELECT 
        idTareas_Actividad,
        nombre_tarea,
        horas_Tareas,
        fechaInicio,
        fechaFin
      FROM tareas_actividad
      WHERE idactividad = ?
      ORDER BY fechaInicio ASC, fechaFin ASC
    `;

    connection.query(sql, [idactividad], (err, results) => {
      if (err) {
        console.error("ERROR TAREAS:", err);
        return res.status(500).json({ error: "Error al obtener tareas" });
      }

      return res.json(results);
    });

    return;
  }

  // Si sí es alumno, primero se obtiene su matrícula
  const sqlAlumno = `SELECT matricula FROM alumno WHERE idusuario = ?`;

  connection.query(sqlAlumno, [idUsuario], (errA, resultA) => {
    if (errA) {
      console.error(errA);
      return res.status(500).json({ error: "Error al obtener alumno" });
    }

    if (!resultA || resultA.length === 0) {
      return res.status(404).json({ error: "Alumno no encontrado" });
    }

    const matricula = resultA[0].matricula;

    // Consulta que además trae el estatus de cumplimiento de cada tarea para ese alumno
    const sql = `
      SELECT 
        ta.idTareas_Actividad,
        ta.nombre_tarea,
        ta.horas_Tareas,
        ta.fechaInicio,
        ta.fechaFin,
        ct.estatus
      FROM tareas_actividad ta
      LEFT JOIN asignacion_actividad aa 
        ON ta.idactividad = aa.idactividad 
        AND aa.matricula = ?
      LEFT JOIN cumplimientotarea ct 
        ON ct.idTareasActividad = ta.idTareas_Actividad
        AND ct.idAsignacionActividad = aa.idasignacion_actividad
      WHERE ta.idactividad = ?
      ORDER BY ta.fechaInicio ASC, ta.fechaFin ASC
    `;

    connection.query(sql, [matricula, idactividad], (err, results) => {
      if (err) {
        console.error("ERROR TAREAS:", err);
        return res.status(500).json({ error: "Error al obtener tareas" });
      }

      return res.json(results);
    });
  });
});
/* =========================
   ACTIVAR ACTIVIDAD AUTOMÁTICAMENTE
   - Si una actividad está en Pendiente
   - y ya se creó al menos una tarea
   - se cambia a Activa
========================= */
function activarActividadSiEstaPendiente(idactividad, callback) {
  const sqlActivar = `
    UPDATE actividad
    SET estatus = 'Activa'
    WHERE idactividad = ?
      AND estatus = 'Pendiente'
  `;

  connection.query(sqlActivar, [idactividad], (err) => {
    if (err) {
      console.error("Error al activar actividad automáticamente:", err);
      return callback(err);
    }

    callback(null);
  });
}

// CREAR TAREA
app.post("/api/tareas", auth, requireRole("responsable"), async (req, res) => {
  let { idactividad, nombre_tarea, horas_Tareas, fechaInicio, fechaFin } =
    req.body;

  idactividad = Number(idactividad);
  horas_Tareas = Number(horas_Tareas);

  if (
    !idactividad ||
    !nombre_tarea ||
    !horas_Tareas ||
    !fechaInicio ||
    !fechaFin
  ) {
    return res.status(400).json({ msg: "Datos incompletos" });
  }

  if (fechaFin < fechaInicio) {
    return res.status(400).json({
      msg: "La fecha de fin no puede ser menor que la fecha de inicio",
    });
  }

  try {
    const validacionFeriados = await validarFechasNoFeriadas(
      fechaInicio,
      fechaFin,
    );

    if (!validacionFeriados.esValida) {
      return res.status(400).json({
        msg: `No se puede crear la tarea: la fecha ${validacionFeriados.fecha} es día festivo (${validacionFeriados.nombreFeriado}).`,
      });
    }

    const sqlSuma = `
      SELECT IFNULL(SUM(horas_Tareas), 0) AS total
      FROM tareas_actividad
      WHERE idactividad = ?
    `;

    connection.query(sqlSuma, [idactividad], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "Error al validar horas" });
      }

      const totalActual = Number(result[0].total) || 0;

      const sqlActividad = `
        SELECT horas_actividad, fecha_alta, fechaTermino
        FROM actividad
        WHERE idactividad = ?
      `;

      connection.query(sqlActividad, [idactividad], (err2, result2) => {
        if (err2) {
          console.error(err2);
          return res.status(500).json({ msg: "Error al consultar actividad" });
        }

        if (!result2 || result2.length === 0) {
          return res.status(404).json({ msg: "Actividad no encontrada" });
        }

        const horasActividad = Number(result2[0].horas_actividad) || 0;

        const fechaProyectoInicio = result2[0].fecha_alta
          ? result2[0].fecha_alta.toISOString().split("T")[0]
          : null;

        const fechaProyectoFin = result2[0].fechaTermino
          ? result2[0].fechaTermino.toISOString().split("T")[0]
          : null;

        if (fechaInicio < fechaProyectoInicio || fechaFin > fechaProyectoFin) {
          return res.status(400).json({
            msg: `La tarea debe estar dentro del rango del proyecto: ${fechaProyectoInicio} a ${fechaProyectoFin}`,
          });
        }

        if (totalActual + horas_Tareas > horasActividad) {
          return res.status(400).json({
            msg: "Las horas exceden el total de la actividad",
          });
        }

        const sqlInsert = `
          INSERT INTO tareas_actividad
          (idactividad, nombre_tarea, horas_Tareas, fechaInicio, fechaFin)
          VALUES (?, ?, ?, ?, ?)
        `;

        connection.query(
          sqlInsert,
          [idactividad, nombre_tarea, horas_Tareas, fechaInicio, fechaFin],
          (err3, resultInsert) => {
            if (err3) {
              console.error(err3);
              return res.status(500).json({ msg: "Error al crear tarea" });
            }

            const idTareaNueva = resultInsert.insertId;

            const sqlAsignarATodos = `
              INSERT INTO cumplimientotarea (idAsignacionActividad, idTareasActividad, estatus)
              SELECT aa.idasignacion_actividad, ?, 'Pendiente'
              FROM asignacion_actividad aa
              WHERE aa.idactividad = ?
            `;

            connection.query(
              sqlAsignarATodos,
              [idTareaNueva, idactividad],
              (err4) => {
                if (err4) {
                  console.error(err4);
                  return res.status(500).json({
                    msg: "Tarea creada, pero ocurrió un error al asignarla a los alumnos",
                  });
                }

                activarActividadSiEstaPendiente(idactividad, (err5) => {
                  if (err5) {
                    return res.status(500).json({
                      msg: "Tarea creada, pero ocurrió un error al activar la actividad",
                    });
                  }

                  return res.json({
                    success: true,
                    msg: "Tarea creada y actividad activada automáticamente",
                  });
                });
              },
            );
          },
        );
      });
    });
  } catch (error) {
    console.error("Error al validar feriados al crear tarea:", error);
    return res.status(500).json({
      msg: "Error al validar días festivos para la tarea",
    });
  }
});

// EDITAR TAREA
app.put(
  "/api/tareas/:id",
  auth,
  requireRole("responsable"),
  async (req, res) => {
    const { id } = req.params;
    let { nombre_tarea, horas_Tareas, fechaInicio, fechaFin } = req.body;

    horas_Tareas = Number(horas_Tareas);

    if (!nombre_tarea || !horas_Tareas || !fechaInicio || !fechaFin) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    if (fechaFin < fechaInicio) {
      return res.status(400).json({
        msg: "La fecha de fin no puede ser menor que la fecha de inicio",
      });
    }

    try {
      const validacionFeriados = await validarFechasNoFeriadas(
        fechaInicio,
        fechaFin,
      );

      if (!validacionFeriados.esValida) {
        return res.status(400).json({
          msg: `No se puede editar la tarea: la fecha ${validacionFeriados.fecha} es día festivo (${validacionFeriados.nombreFeriado}).`,
        });
      }

      const sqlBuscarTarea = `
      SELECT idactividad
      FROM tareas_actividad
      WHERE idTareas_Actividad = ?
    `;

      connection.query(sqlBuscarTarea, [id], (err0, result0) => {
        if (err0) {
          console.error(err0);
          return res.status(500).json({ msg: "Error al buscar la tarea" });
        }

        if (!result0 || result0.length === 0) {
          return res.status(404).json({ msg: "Tarea no encontrada" });
        }

        const idactividad = Number(result0[0].idactividad);

        const sqlSuma = `
        SELECT IFNULL(SUM(horas_Tareas), 0) AS total
        FROM tareas_actividad
        WHERE idactividad = ?
        AND idTareas_Actividad <> ?
      `;

        connection.query(sqlSuma, [idactividad, id], (err1, result1) => {
          if (err1) {
            console.error(err1);
            return res.status(500).json({ msg: "Error al validar horas" });
          }

          const totalActual = Number(result1[0].total) || 0;

          const sqlActividad = `
          SELECT horas_actividad, fecha_alta, fechaTermino
          FROM actividad
          WHERE idactividad = ?
        `;

          connection.query(sqlActividad, [idactividad], (err2, result2) => {
            if (err2) {
              console.error(err2);
              return res
                .status(500)
                .json({ msg: "Error al consultar actividad" });
            }

            if (!result2 || result2.length === 0) {
              return res.status(404).json({ msg: "Actividad no encontrada" });
            }

            const horasActividad = Number(result2[0].horas_actividad) || 0;

            const fechaProyectoInicio = result2[0].fecha_alta
              ? result2[0].fecha_alta.toISOString().split("T")[0]
              : null;

            const fechaProyectoFin = result2[0].fechaTermino
              ? result2[0].fechaTermino.toISOString().split("T")[0]
              : null;

            if (
              fechaInicio < fechaProyectoInicio ||
              fechaFin > fechaProyectoFin
            ) {
              return res.status(400).json({
                msg: `La tarea debe estar dentro del rango del proyecto: ${fechaProyectoInicio} a ${fechaProyectoFin}`,
              });
            }

            if (totalActual + horas_Tareas > horasActividad) {
              return res.status(400).json({
                msg: "Las horas exceden el total de la actividad",
              });
            }

            const sqlUpdate = `
            UPDATE tareas_actividad
            SET nombre_tarea = ?, horas_Tareas = ?, fechaInicio = ?, fechaFin = ?
            WHERE idTareas_Actividad = ?
          `;

            connection.query(
              sqlUpdate,
              [nombre_tarea, horas_Tareas, fechaInicio, fechaFin, id],
              (err3) => {
                if (err3) {
                  console.error(err3);
                  return res.status(500).json({ msg: "Error al editar tarea" });
                }

                return res.json({ success: true });
              },
            );
          });
        });
      });
    } catch (error) {
      console.error("Error al validar feriados al editar tarea:", error);
      return res.status(500).json({
        msg: "Error al validar días festivos para la tarea",
      });
    }
  },
);

// ELIMINAR TAREA
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
   API ASIGNACIÓN (INSCRIPCIÓN DE ALUMNOS)
========================= */

// Ruta que permite al alumno inscribirse en una actividad
app.post("/api/asignacion", auth, requireRole("alumno"), (req, res) => {
  const idUsuario = req.user.idusuario;
  const { idactividad } = req.body;

  // Primero se busca la matrícula del alumno
  const sqlAlumno = `SELECT matricula FROM alumno WHERE idusuario = ?`;

  connection.query(sqlAlumno, [idUsuario], (err, resultAlumno) => {
    if (err || resultAlumno.length === 0) {
      return res.status(500).json({ msg: "Alumno no encontrado" });
    }

    const matricula = resultAlumno[0].matricula;

    // Se consulta la actividad para validar cupo, horas y estatus
    const sqlActividad = `
      SELECT horas_actividad, totalAlumnosRequeridos, estatus
      FROM actividad 
      WHERE idactividad = ?
    `;

    connection.query(sqlActividad, [idactividad], (err2, resultAct) => {
      if (err2 || resultAct.length === 0) {
        return res.status(500).json({ msg: "Actividad no encontrada" });
      }

      const actividad = resultAct[0];

      // Solo se puede inscribir a actividades activas
      if (actividad.estatus !== "Activa") {
        return res.status(400).json({
          msg: "No puedes inscribirte a una actividad no activa",
        });
      }

      // Se calcula cuántas horas lleva ya el alumno
      // Se calcula cuántas horas lleva ya el alumno
      const sqlHoras = `
  SELECT IFNULL(SUM(a.horas_actividad), 0) AS total
  FROM asignacion_actividad aa
  JOIN actividad a ON aa.idactividad = a.idactividad
  WHERE aa.matricula = ?
`;

      connection.query(sqlHoras, [matricula], (errHoras, resultHoras) => {
        if (errHoras) {
          return res.status(500).json({ msg: "Error al calcular horas" });
        }

        const totalHoras = Number(resultHoras[0].total) || 0;
        const horasActividad = Number(actividad.horas_actividad) || 0;

        console.log("Horas actuales:", totalHoras);
        console.log("Horas nueva actividad:", horasActividad);
        console.log("Total final:", totalHoras + horasActividad);

        // Validación para impedir exceder las 480 horas
        if (totalHoras >= 480) {
          return res.status(400).json({
            msg: "Ya completaste tus 480 horas",
          });
        }

        if (totalHoras + horasActividad > 480) {
          return res.status(400).json({
            msg: "No puedes unirte, excede las 480 horas",
          });
        }

        // Verificar que el alumno no esté ya inscrito
        const sqlCheck = `
    SELECT * FROM asignacion_actividad 
    WHERE matricula = ? AND idactividad = ?
  `;

        connection.query(
          sqlCheck,
          [matricula, idactividad],
          (errCheck, resultCheck) => {
            if (errCheck) {
              return res
                .status(500)
                .json({ msg: "Error al validar inscripción" });
            }

            if (resultCheck.length > 0) {
              return res.status(400).json({
                msg: "Ya estás inscrito en esta actividad",
              });
            }

            // Verificar cupo actual
            const sqlCount = `
        SELECT COUNT(*) AS inscritos
        FROM asignacion_actividad
        WHERE idactividad = ?
      `;

            connection.query(sqlCount, [idactividad], (err3, resultCount) => {
              if (err3) {
                return res.status(500).json({ msg: "Error al verificar cupo" });
              }

              const inscritos = Number(resultCount[0].inscritos) || 0;

              if (inscritos >= Number(actividad.totalAlumnosRequeridos)) {
                return res.status(400).json({ msg: "Actividad llena" });
              }

              // Insertar asignación del alumno a la actividad
              const sqlInsert = `
          INSERT INTO asignacion_actividad (matricula, idactividad, estado)
          VALUES (?, ?, 'Pendiente')
        `;

              connection.query(
                sqlInsert,
                [matricula, idactividad],
                (err4, resultInsert) => {
                  if (err4) {
                    return res
                      .status(500)
                      .json({ msg: "Error al asignar actividad" });
                  }

                  const idAsignacion = resultInsert.insertId;

                  const sqlInsertTareas = `
              INSERT INTO cumplimientotarea (idAsignacionActividad, idTareasActividad, estatus)
              SELECT ?, idTareas_Actividad, 'Pendiente'
              FROM tareas_actividad
              WHERE idactividad = ?
            `;

                  connection.query(
                    sqlInsertTareas,
                    [idAsignacion, idactividad],
                    (err5) => {
                      if (err5) {
                        console.error(err5);
                        return res.status(500).json({
                          msg: "Asignación creada pero error en tareas",
                        });
                      }

                      return res.json({
                        success: true,
                        msg: "Asignación completa con tareas",
                      });
                    },
                  );
                },
              );
            });
          },
        );
      });
    });
  });
});

/* =========================================================
   RUTA: OBTENER PROGRESO DEL ALUMNO LOGUEADO
   - Devuelve resumen general de horas
   - Devuelve actividades inscritas
   - Incluye fechas de inicio y término
   - Incluye avance de tareas por actividad
========================================================= */
app.get("/api/progreso", auth, requireRole("alumno"), (req, res) => {
  const idUsuario = req.user.idusuario;

  // 1. Buscar la matrícula del alumno logueado
  const sqlAlumno = `
    SELECT matricula
    FROM alumno
    WHERE idusuario = ?
  `;

  connection.query(sqlAlumno, [idUsuario], (err, resultAlumno) => {
    if (err || !resultAlumno || resultAlumno.length === 0) {
      return res.status(500).json({ msg: "Alumno no encontrado" });
    }

    const matricula = resultAlumno[0].matricula;

    // 2. Consulta principal del progreso
    const sql = `
      SELECT 
        a.idactividad,
        a.nombreActividad,
        a.descripcion,
        a.horas_actividad,
        a.fecha_alta,
        a.fechaTermino,

        aa.estado AS estado_alumno,
        a.estatus AS estado_actividad,

        (
          SELECT IFNULL(SUM(ta.horas_Tareas), 0)
          FROM cumplimientotarea ct
          INNER JOIN tareas_actividad ta 
            ON ct.idTareasActividad = ta.idTareas_Actividad
          WHERE ct.idAsignacionActividad = aa.idasignacion_actividad
            AND ct.estatus = 'Cumplida'
        ) AS horas_ganadas,

        (
          SELECT COUNT(*)
          FROM cumplimientotarea
          WHERE idAsignacionActividad = aa.idasignacion_actividad
        ) AS total_tareas,

        (
          SELECT COUNT(*)
          FROM cumplimientotarea
          WHERE idAsignacionActividad = aa.idasignacion_actividad
            AND estatus = 'Cumplida'
        ) AS tareas_completadas

      FROM asignacion_actividad aa
      INNER JOIN actividad a 
        ON aa.idactividad = a.idactividad
      WHERE aa.matricula = ?
      ORDER BY a.fecha_alta DESC, a.idactividad DESC
    `;

    connection.query(sql, [matricula], (err2, actividades) => {
      if (err2) {
        console.error("Error en progreso:", err2);
        return res.status(500).json({ msg: "Error al obtener progreso" });
      }

      // 3. Limpiar y convertir tipos numéricos
      const actividadesLimpias = (actividades || []).map((act) => ({
        ...act,
        horas_actividad: Number(act.horas_actividad) || 0,
        horas_ganadas: Number(act.horas_ganadas) || 0,
        total_tareas: Number(act.total_tareas) || 0,
        tareas_completadas: Number(act.tareas_completadas) || 0,
      }));

      // 4. Sumar horas liberadas de todas las actividades
      let horasLiberadasTotal = 0;

      actividadesLimpias.forEach((act) => {
        horasLiberadasTotal += act.horas_ganadas;
      });

      // 5. Calcular horas faltantes para 480
      const horasFaltantes = Math.max(0, 480 - horasLiberadasTotal);

      // 6. Responder al frontend
      return res.json({
        horasLiberadas: horasLiberadasTotal,
        horasFaltantes,
        actividades: actividadesLimpias,
      });
    });
  });
});

/* =========================================================
   RUTA: OBTENER TAREAS DE UNA ACTIVIDAD PARA "MI PROGRESO"
   - Valida que la actividad pertenezca al alumno logueado
   - Devuelve nombre del proyecto
   - Devuelve nombre, horas, fecha y estatus de cada tarea
========================================================= */
/* =========================================================
   RUTA: OBTENER TAREAS DE UNA ACTIVIDAD PARA "MI PROGRESO"
   - Valida que la actividad pertenezca al alumno logueado
   - Devuelve nombre del proyecto
   - Devuelve nombre, horas, fecha y estatus de cada tarea
========================================================= */
app.get(
  "/api/progreso/tareas/:idactividad",
  auth,
  requireRole("alumno"),
  (req, res) => {
    const idUsuario = req.user.idusuario;
    const idactividad = Number(req.params.idactividad);

    if (!idactividad) {
      return res.status(400).json({ msg: "ID de actividad inválido" });
    }

    /* =========================================================
       1. BUSCAR MATRÍCULA DEL ALUMNO
    ========================================================= */
    const sqlAlumno = `
      SELECT matricula
      FROM alumno
      WHERE idusuario = ?
    `;

    connection.query(sqlAlumno, [idUsuario], (err, resultAlumno) => {
      if (err) {
        console.error("Error al buscar alumno:", err);
        return res.status(500).json({ msg: "Error al consultar alumno" });
      }

      if (!resultAlumno || resultAlumno.length === 0) {
        return res.status(404).json({ msg: "Alumno no encontrado" });
      }

      const matricula = resultAlumno[0].matricula;

      /* =========================================================
         2. VERIFICAR QUE EL ALUMNO ESTÉ INSCRITO EN ESA ACTIVIDAD
      ========================================================= */
      const sqlAsignacion = `
        SELECT 
          aa.idasignacion_actividad,
          a.nombreActividad
        FROM asignacion_actividad aa
        INNER JOIN actividad a
          ON a.idactividad = aa.idactividad
        WHERE aa.matricula = ?
          AND aa.idactividad = ?
        LIMIT 1
      `;

      connection.query(
        sqlAsignacion,
        [matricula, idactividad],
        (err2, resultAsignacion) => {
          if (err2) {
            console.error("Error al buscar asignación:", err2);
            return res
              .status(500)
              .json({ msg: "Error al consultar asignación" });
          }

          if (!resultAsignacion || resultAsignacion.length === 0) {
            return res.status(404).json({
              msg: "No estás inscrito en esta actividad",
            });
          }

          const idAsignacion = resultAsignacion[0].idasignacion_actividad;
          const nombreActividad = resultAsignacion[0].nombreActividad;

          /* =========================================================
             3. OBTENER TAREAS DE LA ACTIVIDAD
             OJO: aquí cambié fechaEjecucion por fechaTarea
          ========================================================= */
          const sqlTareas = `
            SELECT
              ta.idTareas_Actividad,
              ta.nombre_tarea,
              ta.horas_Tareas,
              ta.fechaInicio,
              ta.fechaFin,
              IFNULL(ct.estatus, 'Pendiente') AS estatus
            FROM tareas_actividad ta
            LEFT JOIN cumplimientotarea ct
              ON ct.idTareasActividad = ta.idTareas_Actividad
             AND ct.idAsignacionActividad = ?
            WHERE ta.idactividad = ?
            ORDER BY ta.fechaInicio ASC, ta.idTareas_Actividad ASC
          `;

          connection.query(
            sqlTareas,
            [idAsignacion, idactividad],
            (err3, tareas) => {
              if (err3) {
                console.error("Error al consultar tareas:", err3);
                return res.status(500).json({ msg: "Error al obtener tareas" });
              }

              const tareasLimpias = (tareas || []).map((t) => ({
                ...t,
                horas_Tareas: Number(t.horas_Tareas) || 0,
              }));

              return res.json({
                nombreActividad,
                tareas: tareasLimpias,
              });
            },
          );
        },
      );
    });
  },
);

/* =========================
   SEGUIMIENTO PARA RESPONSABLES
========================= */

// 1. Obtener alumnos inscritos a una actividad específica del responsable
app.get(
  "/api/seguimiento/alumnos/:idactividad",
  auth,
  requireRole("responsable"),
  (req, res) => {
    const { idactividad } = req.params;

    const sql = `
      SELECT 
        aa.idasignacion_actividad,
        u.nombre AS nombre_alumno,
        u.email,
        u.telefono,
        a.matricula,
        a.foto_perfil,
        g.grupo,
        ut.nombre AS nombre_tutor,
        (SELECT COUNT(*) 
         FROM cumplimientotarea 
         WHERE idAsignacionActividad = aa.idasignacion_actividad 
           AND estatus = 'Cumplida') AS tareas_listas,
        (SELECT COUNT(*) 
         FROM cumplimientotarea 
         WHERE idAsignacionActividad = aa.idasignacion_actividad) AS total_tareas
      FROM asignacion_actividad aa
      INNER JOIN alumno a ON aa.matricula = a.matricula
      INNER JOIN usuario u ON a.idusuario = u.idusuario
      LEFT JOIN grupo g ON a.idgrupo = g.idgrupo
      LEFT JOIN tutor t ON g.idtutor = t.idtutor
      LEFT JOIN usuario ut ON t.idusuario = ut.idusuario
      WHERE aa.idactividad = ?
      ORDER BY u.nombre ASC
    `;

    connection.query(sql, [idactividad], (err, results) => {
      if (err) {
        console.error("Error al obtener alumnos del seguimiento:", err);
        return res.status(500).json({ error: "Error al obtener alumnos" });
      }

      res.json(results);
    });
  },
);

// 2. Obtener tareas de un alumno específico
app.get(
  "/api/seguimiento/tareas-alumno/:idasignacion",
  auth,
  requireRole("responsable"),
  (req, res) => {
    const { idasignacion } = req.params;

    const sql = `
    SELECT 
      ct.idCumplimientoTarea,
      ta.nombre_tarea,
      ta.horas_Tareas,
      ct.estatus
    FROM cumplimientotarea ct
    INNER JOIN tareas_actividad ta ON ct.idTareasActividad = ta.idTareas_Actividad
    WHERE ct.idAsignacionActividad = ?
  `;

    connection.query(sql, [idasignacion], (err, results) => {
      if (err)
        return res
          .status(500)
          .json({ error: "Error al obtener tareas del alumno" });

      res.json(results);
    });
  },
);

// 3. Marcar tarea como cumplida o pendiente
app.put(
  "/api/seguimiento/marcar-tarea",
  auth,
  requireRole("responsable"),
  (req, res) => {
    const { idCumplimientoTarea, nuevoEstatus } = req.body;

    const sqlUpdate = `
      UPDATE cumplimientotarea
      SET estatus = ?
      WHERE idCumplimientoTarea = ?
    `;

    connection.query(
      sqlUpdate,
      [nuevoEstatus, idCumplimientoTarea],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.json({ success: false });
        }

        // Obtener idAsignacionActividad e idactividad relacionados
        const sqlRelacion = `
          SELECT 
            ct.idAsignacionActividad,
            aa.idactividad
          FROM cumplimientotarea ct
          INNER JOIN asignacion_actividad aa
            ON ct.idAsignacionActividad = aa.idasignacion_actividad
          WHERE ct.idCumplimientoTarea = ?
        `;

        connection.query(
          sqlRelacion,
          [idCumplimientoTarea],
          (err2, result2) => {
            if (err2 || result2.length === 0) {
              console.error(err2);
              return res.json({ success: true });
            }

            const idAsignacion = result2[0].idAsignacionActividad;
            const idactividad = result2[0].idactividad;

            // Revisar si el alumno ya completó todas sus tareas
            const sqlCheckAlumno = `
              SELECT COUNT(*) AS pendientes
              FROM cumplimientotarea
              WHERE idAsignacionActividad = ?
              AND estatus != 'Cumplida'
            `;

            connection.query(
              sqlCheckAlumno,
              [idAsignacion],
              (err3, result3) => {
                if (err3) {
                  console.error(err3);
                  return res.json({ success: true });
                }

                const pendientesAlumno = Number(result3[0].pendientes || 0);

                let sqlEstadoAlumno = "";
                let paramsEstadoAlumno = [];

                if (pendientesAlumno === 0) {
                  sqlEstadoAlumno = `
                    UPDATE asignacion_actividad
                    SET estado = 'Completado'
                    WHERE idasignacion_actividad = ?
                  `;
                  paramsEstadoAlumno = [idAsignacion];
                } else {
                  sqlEstadoAlumno = `
                    UPDATE asignacion_actividad
                    SET estado = 'Asignada'
                    WHERE idasignacion_actividad = ?
                  `;
                  paramsEstadoAlumno = [idAsignacion];
                }

                connection.query(
                  sqlEstadoAlumno,
                  paramsEstadoAlumno,
                  (err4) => {
                    if (err4) {
                      console.error(err4);
                      return res.json({ success: false });
                    }

                    // Revisar si toda la actividad ya quedó finalizada
                    const sqlCheckActividad = `
                      SELECT COUNT(*) AS pendientesActividad
                      FROM cumplimientotarea ct
                      INNER JOIN asignacion_actividad aa
                        ON ct.idAsignacionActividad = aa.idasignacion_actividad
                      WHERE aa.idactividad = ?
                      AND ct.estatus != 'Cumplida'
                    `;

                    connection.query(
                      sqlCheckActividad,
                      [idactividad],
                      (err5, result5) => {
                        if (err5) {
                          console.error(err5);
                          return res.json({ success: true });
                        }

                        const pendientesActividad = Number(
                          result5[0].pendientesActividad || 0,
                        );

                        // También revisamos si hay alumnos inscritos,
                        // para no finalizar una actividad vacía por error
                        const sqlInscritos = `
                          SELECT COUNT(*) AS inscritos
                          FROM asignacion_actividad
                          WHERE idactividad = ?
                        `;

                        connection.query(
                          sqlInscritos,
                          [idactividad],
                          (err6, result6) => {
                            if (err6) {
                              console.error(err6);
                              return res.json({ success: true });
                            }

                            const inscritos = Number(result6[0].inscritos || 0);

                            let sqlEstadoActividad = "";
                            let paramsEstadoActividad = [];

                            if (inscritos > 0 && pendientesActividad === 0) {
                              sqlEstadoActividad = `
                                UPDATE actividad
                                SET estatus = 'Finalizada'
                                WHERE idactividad = ?
                              `;
                              paramsEstadoActividad = [idactividad];
                            } else {
                              // Si ya no está completamente terminada,
                              // y no está cancelada ni pendiente,
                              // la regresamos a Activa
                              sqlEstadoActividad = `
                                UPDATE actividad
                                SET estatus = 'Activa'
                                WHERE idactividad = ?
                                AND estatus NOT IN ('Cancelada', 'Pendiente')
                              `;
                              paramsEstadoActividad = [idactividad];
                            }

                            connection.query(
                              sqlEstadoActividad,
                              paramsEstadoActividad,
                              (err7) => {
                                if (err7) {
                                  console.error(err7);
                                  return res.json({ success: false });
                                }

                                return res.json({ success: true });
                              },
                            );
                          },
                        );
                      },
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  },
);

/* =========================
   SERVER 
========================= */

// app.listen inicia el servidor en el puerto definido y muestra un mensaje en consola
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

/*
RESUMEN GENERAL DEL ARCHIVO server.js

Este archivo server.js es el backend principal del sistema de servicio social.
Aquí se configura el servidor usando Express, se conecta con la base de datos
mediante el archivo db.js y se definen todas las rutas de la API.

Entre las funciones principales de este archivo están:

1. Validar usuarios mediante login con JWT.
2. Proteger rutas con middleware de autenticación y roles.
3. Consultar grupos, alumnos, actividades, responsables y progreso.
4. Crear, editar, cancelar actividades.
5. Crear, editar, eliminar tareas de actividades.
6. Registrar nuevos usuarios según su rol.
7. Permitir que los alumnos se inscriban a actividades.
8. Dar seguimiento al cumplimiento de tareas por parte de responsables.

En pocas palabras, este archivo controla toda la lógica principal del sistema
y sirve como puente entre el frontend y la base de datos.
*/
