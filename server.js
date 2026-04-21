// Mensaje simple para confirmar en consola que este archivo server.js sí está corriendo
console.log("SERVER CORRECTO");

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

// Se importa la librería fs para manejar archivos en el sistema, como eliminar fotos antiguas
const fs = require("fs");

// Se crea la aplicación principal de express y se guarda en la constante app
const app = express();

// Se define el puerto donde va a correr el servidor
const PORT = 3000;

// app.use(cors()) habilita CORS para permitir peticiones desde el frontend
app.use(cors());

// app.use(express.json()) permite que express entienda datos en formato JSON enviados en req.body
app.use(express.json());

// Clave secreta usada para firmar y verificar tokens JWT
const JWT_SECRET = "clave-super-secreta";

/* =========================
   MIDDLEWARES DE AUTENTICACIÓN Y ROLES
========================= */

// Este middleware valida que la petición traiga un token JWT válido
// req es la peticion que llega, res la respuesta que se va a neviar y next es para seguir con lo que sigue después del middleware (como la función de la ruta)
function auth(req, res, next) {
  // Se obtiene el encabezado Authorization de la petición
  const header = req.headers.authorization;

  // Si no existe el header o no comienza con "Bearer ", se rechaza la petición
  if (!header || !header.startsWith("Bearer ")) {
    // .startsWith es una función de JavaScript que verifica si un texto comienza con cierto prefijo
    return res.status(401).json({ error: "No autorizado" });
    // error 401 es de parte del backend, significa "“No te dejo pasar porque no me mandaste credenciales válidas.”"
  }

  // Se separa el token del texto "Bearer ", esto quiere decir que si el header es "Bearer abcdefg12345", entonces token va a ser "abcdefg12345"
  const token = header.split(" ")[1]; //.split es una función de JavaScript que divide un texto en un array de substrings.
  // En este caso se divide el header en dos partes usando el espacio como separador, entonces se obtiene un array ["Bearer", "abcdefg12345"] y al poner [1] se toma la segunda parte que es el token en sí.

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

// Esta función recibe uno o varios roles permitidos y regresa un middleware
function requireRole(...roles) {
  // los tres puntos son para permitir mas de un rol, entonces se puede usar requireRole("administrador") o requireRole("administrador", "tutor") dependiendo de qué roles quieras permitir para esa ruta
  return (req, res, next) => {
    // Primero se verifica que exista req.user y que dentro de req.user sí exista el rol
    if (!req.user || !req.user.rol) {
      //se usa el not de la forma, si no existe req.user o no existe req.user.rol da falso pero se convierte a true con el not y entra a la condicional
      console.error("Error: intento de acceso sin rol definido en req.user");
      return res
        .status(403) //El error 403 es del servido/backend, significa “Sí sé quién eres” o “sí recibí tus credenciales”, pero no tienes permiso para hacer eso.
        .json({ error: "No autorizado: rol no encontrado" });
    }

    // Se toma el rol del usuario, se convierte a texto, se limpian espacios con el .trim() y se pasa a minúsculas con .toLowerCase() para evitar problemas de comparación por mayúsculas o espacios
    const userRol = String(req.user.rol).trim().toLowerCase();

    //roles.map es para crear un nuevo array a partir del array de roles que se le pasó a la función, y en ese nuevo array cada rol se convierte a texto, se limpian espacios y se pasan a minúsculas.
    const rolesPermitidos = roles.map((r) => String(r).trim().toLowerCase());

    // Si el rol del usuario no está dentro de los permitidos, se bloquea
    if (!rolesPermitidos.includes(userRol)) {
      //includes es una función de JavaScript que verifica si un elemento se encuentra en un array
      console.warn(
        //.warn es para mostrar un mensaje de advertencia en la consola, se usa aquí para registrar intentos de acceso no autorizados por roles incorrectos
        `Bloqueado: el rol '${userRol}' intentó entrar a una ruta permitida solo para: ${rolesPermitidos.join(", ")}`, //join es una función de JavaScript que convierte un array en un texto, uniendo los elementos con el separador que se le indique, en este caso una coma y espacio ", "
      );
      return res.status(403).json({ error: "Sin permisos suficientes" });
    }

    // Si todo está correcto, se permite el acceso a la ruta
    next();
  };
}

/* =========================================================
   CONFIGURACIÓN DE MULTER PARA GUARDAR FOTOS DE ALUMNOS
   - Aquí se configura multer para que, cuando un alumno suba una foto,
     el archivo se guarde físicamente en una carpeta del servidor.
   - multer.diskStorage(...) sirve para indicar:
       1) en qué carpeta se guardará el archivo
       2) con qué nombre se guardará
========================================================= */
const storageFotoAlumno = multer.diskStorage({
  /* =========================================================
     destination
     - Esta función define la carpeta destino donde se guardará
       el archivo que el usuario suba.
     - Recibe 3 parámetros:
         req  -> la petición completa
         file -> información del archivo subido
         cb   -> callback que multer usa para continuar
     - cb(error, destino)
       Si no hay error, se manda null en el primer parámetro.
       En el segundo parámetro se manda la ruta donde guardar.
  ========================================================= */
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads/alumnos"));

    // path.join(...) une las rutas correctamente dependiendo del sistema operativo
    // __dirname representa la carpeta actual donde está este archivo, por ejemplo server.js
    // "uploads/alumnos" es la carpeta interna donde se guardarán las fotos
    // Entonces el archivo terminará guardándose en:
    // [carpeta actual del proyecto]/uploads/alumnos
  },

  /* =========================================================
     filename
     - Esta función define con qué nombre se guardará el archivo
       dentro de la carpeta destino.
     - También recibe:
         req  -> la petición
         file -> datos del archivo original
         cb   -> callback para devolver el nombre final
  ========================================================= */
  filename: (req, file, cb) => {
    /* =========================================================
       path.extname(file.originalname)
       - Obtiene la extensión del archivo original que subió el usuario.
       - file.originalname es el nombre original del archivo.
       - Ejemplo:
           "foto.jpg"   -> ".jpg"
           "credencial.png" -> ".png"
       - Esto sirve para conservar el tipo/extensión del archivo.
    ========================================================= */
    const ext = path.extname(file.originalname);

    /* =========================================================
       Se crea un nombre único para evitar que se repitan archivos.
       - "alumno_" es un prefijo para identificar que es una foto de alumno
       - req.user.idusuario toma el id del usuario autenticado
       - Date.now() devuelve la fecha actual en milisegundos
         y ayuda a que el nombre sea diferente cada vez
       - ext agrega la extensión original del archivo
       
       Ejemplo de resultado:
       alumno_15_1713658483921.jpg
    ========================================================= */
    const nombreArchivo = `alumno_${req.user.idusuario}_${Date.now()}${ext}`;

    /* =========================================================
       cb(null, nombreArchivo)
       - Se llama al callback para decirle a multer:
         "no hubo error y este será el nombre del archivo"
       - null significa que no hay error
       - nombreArchivo es el nombre final con el que se guardará
    ========================================================= */
    cb(null, nombreArchivo);
  },
});

/* =========================================================
   FILTRO PARA VALIDAR IMÁGENES SUBIDAS
   - Esta función se usa en multer para revisar si el archivo
     que el usuario intenta subir sí es una imagen permitida.
   - Sirve como una capa de seguridad para aceptar solo ciertos
     formatos de imagen.
   - Recibe 3 parámetros:
       req  -> la petición completa
       file -> información del archivo subido
       cb   -> callback que multer usa para aceptar o rechazar el archivo
========================================================= */
const fileFilterImagen = (req, file, cb) => {
  /* =========================================================
     tiposPermitidos
     - Aquí se define una expresión regular con los formatos
       de imagen que sí estarán permitidos.
     - /jpeg|jpg|png|webp/ significa que solo se aceptarán
       archivos que contengan alguna de esas extensiones o tipos.
     - Los tipos permitidos son:
         jpeg
         jpg
         png
         webp
  ========================================================= */
  const tiposPermitidos = /jpeg|jpg|png|webp/;

  /* =========================================================
     path.extname(file.originalname)
     - Obtiene la extensión del archivo original subido.
     - file.originalname es el nombre original del archivo,
       por ejemplo: "fotoPerfil.PNG"
     - path.extname(...) devolvería: ".PNG"

     toLowerCase()
     - Convierte la extensión a minúsculas para evitar problemas
       si el usuario sube algo como .JPG, .Png, .WEBP, etc.

     tiposPermitidos.test(...)
     - test() revisa si la extensión coincide con alguno de los
       formatos permitidos.
     - El resultado será true o false

     Ejemplos:
       ".jpg"  -> true
       ".png"  -> true
       ".pdf"  -> false
  ========================================================= */
  const ext = tiposPermitidos.test(
    path.extname(file.originalname).toLowerCase(),
  );

  /* =========================================================
     file.mimetype
     - Es el tipo MIME del archivo, es decir, el tipo que trae
       el archivo a nivel de contenido.
     - Ejemplos:
         image/jpeg
         image/png
         image/webp

     tiposPermitidos.test(file.mimetype)
     - Aquí se revisa si el mimetype también coincide con los
       tipos permitidos.
     - Esto ayuda a validar no solo la extensión, sino también
       el tipo real del archivo.
     - El resultado también será true o false
  ========================================================= */
  const mime = tiposPermitidos.test(file.mimetype);

  /* =========================================================
     console.log(...)
     - Estas líneas son solo para depuración.
     - Sirven para ver en la consola del servidor si la extensión
       y el mimetype fueron válidos o no.
     - Ayudan mucho cuando estás probando por qué multer rechaza
       un archivo.
  ========================================================= */
  console.log("Ext válida:", ext);
  console.log("Mime válido:", mime);

  /* =========================================================
     Si ambas validaciones son correctas:
     - ext  -> la extensión es válida
     - mime -> el tipo MIME es válido

     entonces se acepta el archivo.

     cb(null, true)
     - null indica que no hay error
     - true indica que multer sí debe aceptar el archivo
  ========================================================= */
  if (ext && mime) {
    return cb(null, true);
  }

  /* =========================================================
     Si alguna de las dos validaciones falla:
     - o la extensión no es permitida
     - o el mimetype no es válido

     entonces se rechaza el archivo.

     cb(new Error(...))
     - Se manda un error personalizado
     - multer detecta este error y no deja subir el archivo

     En este caso el mensaje será:
     "Solo se permiten imágenes JPG, PNG o WEBP"
  ========================================================= */
  cb(new Error("Solo se permiten imágenes JPG, PNG o WEBP"));
};

/* =========================================================
   CONFIGURACIÓN FINAL DE MULTER PARA SUBIR FOTO DE ALUMNO
   - Aquí se crea una instancia de multer con la configuración
     que ya se definió anteriormente.
   - Esta configuración le dice a multer:
       1) dónde guardar el archivo
       2) qué tipos de archivo permitir
       3) cuál es el tamaño máximo permitido
   - Después esta constante se usa en las rutas, por ejemplo:
       uploadFotoAlumno.single("foto")
========================================================= */
const uploadFotoAlumno = multer({
  /* =========================================================
     storage
     - Aquí se le indica a multer qué configuración de almacenamiento
       va a usar para guardar los archivos.
     - storageFotoAlumno fue creado antes con multer.diskStorage(...)
     - Ahí se definió:
         * la carpeta destino
         * el nombre final del archivo
     - En este caso, las fotos se guardarán físicamente en el servidor
       dentro de la carpeta uploads/alumnos
  ========================================================= */
  storage: storageFotoAlumno,

  /* =========================================================
     fileFilter
     - Aquí se le pasa la función que valida si el archivo que
       se intenta subir sí está permitido.
     - fileFilterImagen revisa:
         * la extensión del archivo
         * el tipo MIME
     - Si el archivo es jpg, jpeg, png o webp, lo acepta.
     - Si no, multer lo rechaza con un error.
  ========================================================= */
  fileFilter: fileFilterImagen,

  /* =========================================================
     limits
     - Sirve para establecer restricciones al archivo subido.
     - Aquí se pueden poner límites como:
         * tamaño máximo
         * cantidad de archivos
         * longitud de campos, etc.
     - En este caso solo se está limitando el tamaño del archivo.
  ========================================================= */
  limits: {
    /* =========================================================
       fileSize
       - Define el tamaño máximo permitido del archivo en bytes.
       - 5 * 1024 * 1024 significa:
           5 megabytes

       Desglose:
       - 1024 bytes = 1 KB
       - 1024 KB = 1 MB
       - 5 * 1024 * 1024 = 5 MB

       Entonces, si el usuario intenta subir una imagen mayor
       a 5 MB, multer la rechazará automáticamente.
    ========================================================= */
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/* =========================================================
   HELPERS ADMIN, Estas funciones se usan en el controlador de administrador para validar datos, 
   obtener información o revisar si ya existen ciertos registros en la base de datos.
========================================================= */

/* =========================================================
   OBTENER ID DEL ROL POR SU NOMBRE
   - Busca en la tabla rol el idRol correspondiente
========================================================= */
function obtenerIdRolPorNombre(nombreRol, callback) {
  /* =========================================================
     CONSULTA SQL
     - Busca el id del rol en la tabla rol
     - Compara el nombre sin importar mayúsculas o minúsculas
     - LIMIT 1 asegura que solo se tome un registro
  ========================================================= */
  const sql = `
    SELECT idRol
    FROM rol
    WHERE LOWER(nombreRol) = LOWER(?)
    LIMIT 1
  `;

  // Ejecuta la consulta pasando el nombre del rol
  connection.query(sql, [nombreRol], (err, result) => {
    // Si hay error en la consulta, lo regresa al callback
    if (err) return callback(err);

    // Si no encuentra registros, manda error personalizado
    if (!result || result.length === 0) {
      return callback(new Error(`Rol no encontrado: ${nombreRol}`));
    }

    // Si lo encuentra, devuelve el idRol
    callback(null, result[0].idRol);
  });
}

/* =========================================================
   VALIDAR SI YA EXISTE UN USUARIO POR SU EMAIL
   - Revisa en la tabla usuario si el correo ya está registrado
========================================================= */
function existeUsuarioPorEmail(email, callback) {
  /* =========================================================
     CONSULTA SQL
     - Busca un usuario por su correo electrónico
     - Solo selecciona idusuario porque solo interesa saber
       si existe o no
     - LIMIT 1 hace que solo tome un registro
  ========================================================= */
  const sql = `
    SELECT idusuario
    FROM usuario
    WHERE email = ?
    LIMIT 1
  `;

  // Ejecuta la consulta enviando el email como parámetro
  connection.query(sql, [email], (err, result) => {
    // Si hay error en la consulta, lo devuelve al callback
    if (err) return callback(err);

    // Devuelve true si encontró al menos un usuario, o false si no existe
    callback(null, result && result.length > 0);
  });
}

/* =========================================================
   VALIDAR SI YA EXISTE UN ALUMNO CON ESA MATRÍCULA
   - Revisa en la tabla alumno si la matrícula ya está registrada
========================================================= */
function existeAlumnoPorMatricula(matricula, callback) {
  /* =========================================================
     CONSULTA SQL
     - Busca una matrícula en la tabla alumno
     - Solo selecciona matricula porque solo interesa saber
       si ya existe o no
     - LIMIT 1 hace que solo tome un registro
  ========================================================= */
  const sql = `
    SELECT matricula
    FROM alumno
    WHERE matricula = ?
    LIMIT 1
  `;

  // Ejecuta la consulta enviando la matrícula como parámetro
  connection.query(sql, [matricula], (err, result) => {
    // Si hay error en la consulta, lo devuelve al callback
    if (err) return callback(err);

    // Devuelve true si la matrícula ya existe, o false si no existe
    callback(null, result && result.length > 0);
  });
}

/* =========================================================
   VALIDAR SI EXISTE UN GRUPO POR SU ID
   - Revisa en la tabla grupo si el idgrupo existe
========================================================= */
function existeGrupoPorId(idgrupo, callback) {
  /* =========================================================
     CONSULTA SQL
     - Busca el id del grupo en la tabla grupo
     - Solo se usa para verificar si existe
     - LIMIT 1 hace que solo tome un registro
  ========================================================= */
  const sql = "SELECT idgrupo FROM grupo WHERE idgrupo = ? LIMIT 1";

  // Ejecuta la consulta enviando el id del grupo
  connection.query(sql, [idgrupo], (err, results) => {
    // Si hay error en la consulta, lo devuelve y manda false
    if (err) return callback(err, false);

    // Devuelve true si encontró el grupo, o false si no existe
    callback(null, results.length > 0);
  });
}

/* =========================================================
   VALORES PERMITIDOS
   - Estos arreglos guardan los valores válidos para ciertas validaciones
========================================================= */

// Tipos de administrador permitidos
const TIPOS_ADMIN_VALIDOS = ["alumno", "tutor", "responsable", "subdirector"];

// Estatus permitidos
const ESTATUS_VALIDOS = ["activo", "inactivo", "baja_temporal"];

// Turnos permitidos
const TURNOS_VALIDOS = ["Matutino", "Vespertino"];

/* =========================================================
   VALIDAR TIPO DE ADMINISTRADOR
   - Verifica si el tipo recibido está dentro de los valores permitidos
========================================================= */
function tipoAdminValido(tipo) {
  // Convierte el valor a texto y a minúsculas antes de validarlo
  return TIPOS_ADMIN_VALIDOS.includes(String(tipo || "").toLowerCase());
}

/* =========================================================
   VALIDAR ESTATUS
   - Verifica si el estatus recibido está dentro de los valores permitidos
========================================================= */
function estatusValido(estatus) {
  // Convierte el valor a texto y a minúsculas antes de validarlo
  return ESTATUS_VALIDOS.includes(String(estatus || "").toLowerCase());
}

/* =========================================================
   VALIDAR TURNO
   - Verifica si el turno recibido está dentro de los valores permitidos
========================================================= */
function turnoValido(turno) {
  // Convierte el valor a texto antes de validarlo
  return TURNOS_VALIDOS.includes(String(turno || ""));
}

/* =========================================================
   LISTAR ALUMNOS PARA EL PANEL DE ADMINISTRACIÓN
   - Devuelve el listado de alumnos con sus datos principales
   - Solo puede entrar un usuario autenticado con rol administrador
========================================================= */
app.get(
  "/api/admin/listado/alumnos",
  auth,
  requireRole("administrador"),
  (req, res) => {
    /* =========================================================
       CONSULTA SQL
       - Obtiene datos del alumno desde la tabla alumno
       - Une con usuario para traer nombre, email, teléfono y estatus
       - Une con grupo para obtener el nombre del grupo
       - Ordena el resultado alfabéticamente por nombre
    ========================================================= */
    const sql = `
      SELECT
        u.idusuario,
        a.matricula,
        a.idgrupo,
        u.nombre,
        u.email,
        u.telefono,
        u.estatus,
        g.grupo
      FROM alumno a
      INNER JOIN usuario u ON a.idusuario = u.idusuario
      LEFT JOIN grupo g ON a.idgrupo = g.idgrupo
      ORDER BY u.nombre ASC
    `;

    // Ejecuta la consulta
    connection.query(sql, (err, results) => {
      // Si ocurre un error, responde con estado 500
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtener alumnos" });
      }

      // Si todo sale bien, devuelve el listado en formato JSON
      res.json(results);
    });
  },
);

/* =========================================================
   ADMIN - LISTADO DE TUTORES
   - Devuelve el listado de tutores para el panel de administración
   - Incluye idusuario, estatus y los grupos asignados
========================================================= */
app.get(
  "/api/admin/listado/tutores",
  auth,
  requireRole("administrador"),
  (req, res) => {
    /* =========================================================
       CONSULTA SQL
       - Obtiene los datos principales de cada tutor
       - Une la tabla tutor con usuario para traer sus datos personales
       - Une con grupo para mostrar los grupos que tiene asignados
       - GROUP_CONCAT junta varios grupos en un solo texto
       - IFNULL muestra 'Sin grupo' si no tiene ninguno asignado
       - GROUP BY evita registros duplicados
       - ORDER BY ordena alfabéticamente por nombre
    ========================================================= */
    const sql = `
      SELECT
        t.idtutor,
        u.idusuario,
        u.nombre,
        u.email,
        u.telefono,
        u.estatus,
        IFNULL(
          GROUP_CONCAT(DISTINCT g.grupo ORDER BY g.idgrupo SEPARATOR ', '),
          'Sin grupo'
        ) AS grupo
      FROM tutor t
      INNER JOIN usuario u ON t.idusuario = u.idusuario
      LEFT JOIN grupo g ON g.idtutor = t.idtutor
      GROUP BY
        t.idtutor,
        u.idusuario,
        u.nombre,
        u.email,
        u.telefono,
        u.estatus
      ORDER BY u.nombre ASC
    `;

    // Ejecuta la consulta
    connection.query(sql, (err, results) => {
      // Si hay error, responde con estado 500
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtener tutores" });
      }

      // Si todo sale bien, devuelve el listado en formato JSON
      res.json(results);
    });
  },
);

/* =========================================================
   ADMIN - LISTADO DE RESPONSABLES
   - Devuelve el listado de responsables para el panel de administración
   - Incluye idusuario, estatus y ubicación
========================================================= */
app.get(
  "/api/admin/listado/responsables",
  auth,
  requireRole("administrador"),
  (req, res) => {
    /* =========================================================
       CONSULTA SQL
       - Obtiene los datos principales de cada responsable
       - Une la tabla responsable con usuario para traer
         nombre, email, teléfono y estatus
       - También incluye la ubicación del responsable
       - ORDER BY ordena alfabéticamente por nombre
    ========================================================= */
    const sql = `
      SELECT
        r.idresponsable,
        u.idusuario,
        u.nombre,
        u.email,
        u.telefono,
        u.estatus,
        r.ubicacion
      FROM responsable r
      INNER JOIN usuario u ON r.idusuario = u.idusuario
      ORDER BY u.nombre ASC
    `;

    // Ejecuta la consulta
    connection.query(sql, (err, results) => {
      // Si hay error, responde con estado 500
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtener responsables" });
      }

      // Si todo sale bien, devuelve el listado en formato JSON
      res.json(results);
    });
  },
);

/* =========================================================
   ADMIN - LISTADO DE SUBDIRECTORES
   - Devuelve el listado de subdirectores para el panel de administración
   - Por ahora toma a los usuarios que tienen el rol Director
========================================================= */
app.get(
  "/api/admin/listado/subdirectores",
  auth,
  requireRole("administrador"),
  (req, res) => {
    /* =========================================================
       CONSULTA SQL
       - Obtiene los datos principales de los usuarios
       - Une usuario con rol para filtrar solo los que tienen
         el rol Director
       - Incluye idusuario, nombre, email, teléfono y estatus
       - ORDER BY ordena alfabéticamente por nombre
    ========================================================= */
    const sql = `
      SELECT
        u.idusuario,
        u.nombre,
        u.email,
        u.telefono,
        u.estatus
      FROM usuario u
      INNER JOIN rol r ON u.idRol = r.idRol
      WHERE LOWER(r.nombreRol) = 'director'
      ORDER BY u.nombre ASC
    `;

    // Ejecuta la consulta
    connection.query(sql, (err, results) => {
      // Si hay error, responde con estado 500
      if (err) {
        console.error(err);
        return res
          .status(500)
          .json({ error: "Error al obtener subdirectores" });
      }

      // Si todo sale bien, devuelve el listado en formato JSON
      res.json(results);
    });
  },
);

/* =========================================================
   ADMIN - REGISTRAR ALUMNO
   - Registra un nuevo alumno desde el panel de administración
   - Primero crea el usuario y después el registro en alumno
   - Usa transacción para que ambos inserts se guarden juntos
========================================================= */
app.post(
  "/api/admin/registrar-alumno",
  auth,
  requireRole("administrador"),
  (req, res) => {
    // Extrae los datos enviados en el body
    const { matricula, idgrupo, nombre, email, telefono, password } = req.body;

    // Valida que no falten datos obligatorios
    if (!matricula || !idgrupo || !nombre || !email || !telefono || !password) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    // Verifica si ya existe un usuario con ese correo
    existeUsuarioPorEmail(email, (errEmail, existeEmail) => {
      if (errEmail) {
        console.error(errEmail);
        return res.status(500).json({ msg: "Error al validar email" });
      }

      // Si el correo ya existe, detiene el registro
      if (existeEmail) {
        return res
          .status(400)
          .json({ msg: "Ya existe un usuario con ese correo" });
      }

      // Verifica si la matrícula ya está registrada
      existeAlumnoPorMatricula(matricula, (errMat, existeMatricula) => {
        if (errMat) {
          console.error(errMat);
          return res.status(500).json({ msg: "Error al validar matrícula" });
        }

        // Si la matrícula ya existe, detiene el registro
        if (existeMatricula) {
          return res
            .status(400)
            .json({ msg: "La matrícula ya está registrada" });
        }

        // Verifica que el grupo exista
        existeGrupoPorId(idgrupo, (errGrupo, existeGrupo) => {
          if (errGrupo) {
            console.error(errGrupo);
            return res.status(500).json({ msg: "Error al validar grupo" });
          }

          // Si el grupo no existe, detiene el registro
          if (!existeGrupo) {
            return res
              .status(400)
              .json({ msg: "El grupo seleccionado no existe" });
          }

          // Obtiene el id del rol Alumno
          obtenerIdRolPorNombre("Alumno", (errRol, idRolAlumno) => {
            if (errRol) {
              console.error(errRol);
              return res
                .status(500)
                .json({ msg: "No se encontró el rol Alumno" });
            }

            // Inicia transacción para guardar usuario y alumno juntos
            connection.beginTransaction((errTx) => {
              if (errTx) {
                console.error(errTx);
                return res
                  .status(500)
                  .json({ msg: "Error al iniciar transacción" });
              }

              /* =========================================================
                 CONSULTA SQL
                 - Inserta el nuevo usuario en la tabla usuario
                 - Guarda nombre, password, rol, teléfono, email y estatus
                 - El estatus se registra como 'activo'
              ========================================================= */
              const sqlUsuario = `
                INSERT INTO usuario (nombre, password, idRol, telefono, email, estatus)
                VALUES (?, ?, ?, ?, ?, ?)
              `;

              // Inserta primero el usuario
              connection.query(
                sqlUsuario,
                [nombre, password, idRolAlumno, telefono, email, "activo"],
                (errUser, resultUser) => {
                  // Si falla, revierte la transacción
                  if (errUser) {
                    return connection.rollback(() => {
                      console.error(errUser);
                      res
                        .status(500)
                        .json({ msg: "Error al crear usuario del alumno" });
                    });
                  }

                  // Guarda el id del nuevo usuario insertado
                  const idusuarioNuevo = resultUser.insertId;

                  /* =========================================================
                     CONSULTA SQL
                     - Inserta el alumno en la tabla alumno
                     - Relaciona matrícula, usuario y grupo
                  ========================================================= */
                  const sqlAlumno = `
                    INSERT INTO alumno (matricula, idusuario, idgrupo)
                    VALUES (?, ?, ?)
                  `;

                  // Inserta el registro del alumno
                  connection.query(
                    sqlAlumno,
                    [matricula, idusuarioNuevo, idgrupo],
                    (errAlumno) => {
                      // Si falla, revierte la transacción
                      if (errAlumno) {
                        return connection.rollback(() => {
                          console.error(errAlumno);
                          res
                            .status(500)
                            .json({ msg: "Error al crear alumno" });
                        });
                      }

                      // Confirma la transacción si todo salió bien
                      connection.commit((errCommit) => {
                        // Si falla el commit, revierte la transacción
                        if (errCommit) {
                          return connection.rollback(() => {
                            console.error(errCommit);
                            res
                              .status(500)
                              .json({ msg: "Error al confirmar transacción" });
                          });
                        }

                        // Respuesta final de éxito
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
   - Registra un nuevo tutor desde el panel de administración
   - Primero crea el usuario y después el registro en tutor
   - Usa transacción para guardar ambos registros juntos
========================================================= */
app.post(
  "/api/admin/registrar-tutor",
  auth,
  requireRole("administrador"),
  (req, res) => {
    // Extrae los datos enviados en el body
    const { nombre, email, telefono, password } = req.body;

    // Valida que no falten datos obligatorios
    if (!nombre || !email || !telefono || !password) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    // Verifica si ya existe un usuario con ese correo
    existeUsuarioPorEmail(email, (errEmail, existeEmail) => {
      if (errEmail) {
        console.error(errEmail);
        return res.status(500).json({ msg: "Error al validar email" });
      }

      // Si el correo ya existe, detiene el registro
      if (existeEmail) {
        return res
          .status(400)
          .json({ msg: "Ya existe un usuario con ese correo" });
      }

      // Obtiene el id del rol Tutor
      obtenerIdRolPorNombre("Tutor", (errRol, idRolTutor) => {
        if (errRol) {
          console.error(errRol);
          return res.status(500).json({ msg: "No se encontró el rol Tutor" });
        }

        // Inicia transacción para guardar usuario y tutor juntos
        connection.beginTransaction((errTx) => {
          if (errTx) {
            console.error(errTx);
            return res
              .status(500)
              .json({ msg: "Error al iniciar transacción" });
          }

          /* =========================================================
             CONSULTA SQL
             - Inserta el nuevo usuario en la tabla usuario
             - Guarda nombre, password, rol, teléfono, email y estatus
             - El estatus se registra como 'activo'
          ========================================================= */
          const sqlUsuario = `
            INSERT INTO usuario (nombre, password, idRol, telefono, email, estatus)
            VALUES (?, ?, ?, ?, ?, ?)
          `;

          // Inserta primero el usuario
          connection.query(
            sqlUsuario,
            [nombre, password, idRolTutor, telefono, email, "activo"],
            (errUser, resultUser) => {
              // Si falla, revierte la transacción
              if (errUser) {
                return connection.rollback(() => {
                  console.error(errUser);
                  res
                    .status(500)
                    .json({ msg: "Error al crear usuario del tutor" });
                });
              }

              // Guarda el id del nuevo usuario insertado
              const idusuarioNuevo = resultUser.insertId;

              /* =========================================================
                 CONSULTA SQL
                 - Inserta el tutor en la tabla tutor
                 - Lo relaciona con el id del usuario recién creado
              ========================================================= */
              const sqlTutor = `
                INSERT INTO tutor (idusuario)
                VALUES (?)
              `;

              // Inserta el registro del tutor
              connection.query(sqlTutor, [idusuarioNuevo], (errTutor) => {
                // Si falla, revierte la transacción
                if (errTutor) {
                  return connection.rollback(() => {
                    console.error(errTutor);
                    res.status(500).json({ msg: "Error al crear tutor" });
                  });
                }

                // Confirma la transacción si todo salió bien
                connection.commit((errCommit) => {
                  // Si falla el commit, revierte la transacción
                  if (errCommit) {
                    return connection.rollback(() => {
                      console.error(errCommit);
                      res.status(500).json({
                        msg: "Error al confirmar transacción",
                      });
                    });
                  }

                  // Respuesta final de éxito
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
   - Registra un nuevo responsable desde el panel de administración
   - Primero crea el usuario y después el registro en responsable
   - Usa transacción para guardar ambos registros juntos
========================================================= */
app.post(
  "/api/admin/registrar-responsable",
  auth,
  requireRole("administrador"),
  (req, res) => {
    // Extrae los datos enviados en el body
    const { nombre, email, telefono, password } = req.body;

    // Valida que no falten datos obligatorios
    if (!nombre || !email || !telefono || !password) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    // Verifica si ya existe un usuario con ese correo
    existeUsuarioPorEmail(email, (errEmail, existeEmail) => {
      if (errEmail) {
        console.error(errEmail);
        return res.status(500).json({ msg: "Error al validar email" });
      }

      // Si el correo ya existe, detiene el registro
      if (existeEmail) {
        return res
          .status(400)
          .json({ msg: "Ya existe un usuario con ese correo" });
      }

      // Obtiene el id del rol Responsable
      obtenerIdRolPorNombre("Responsable", (errRol, idRolResponsable) => {
        if (errRol) {
          console.error(errRol);
          return res
            .status(500)
            .json({ msg: "No se encontró el rol Responsable" });
        }

        // Inicia transacción para guardar usuario y responsable juntos
        connection.beginTransaction((errTx) => {
          if (errTx) {
            console.error(errTx);
            return res
              .status(500)
              .json({ msg: "Error al iniciar transacción" });
          }

          /* =========================================================
             CONSULTA SQL
             - Inserta el nuevo usuario en la tabla usuario
             - Guarda nombre, password, rol, teléfono, email y estatus
             - El estatus se registra como 'activo'
          ========================================================= */
          const sqlUsuario = `
            INSERT INTO usuario (nombre, password, idRol, telefono, email, estatus)
            VALUES (?, ?, ?, ?, ?, ?)
          `;

          // Inserta primero el usuario
          connection.query(
            sqlUsuario,
            [nombre, password, idRolResponsable, telefono, email, "activo"],
            (errUser, resultUser) => {
              // Si falla, revierte la transacción
              if (errUser) {
                return connection.rollback(() => {
                  console.error(errUser);
                  res
                    .status(500)
                    .json({ msg: "Error al crear usuario del responsable" });
                });
              }

              // Guarda el id del nuevo usuario insertado
              const idusuarioNuevo = resultUser.insertId;

              /* =========================================================
                 CONSULTA SQL
                 - Inserta el responsable en la tabla responsable
                 - Lo relaciona con el id del usuario recién creado
                 - La ubicación se guarda con valor por defecto
              ========================================================= */
              const sqlResponsable = `
                INSERT INTO responsable (idusuario, ubicacion)
                VALUES (?, ?)
              `;

              // Inserta el registro del responsable
              connection.query(
                sqlResponsable,
                [idusuarioNuevo, "No especificada"],
                (errResp) => {
                  // Si falla, revierte la transacción
                  if (errResp) {
                    return connection.rollback(() => {
                      console.error(errResp);
                      res
                        .status(500)
                        .json({ msg: "Error al crear responsable" });
                    });
                  }

                  // Confirma la transacción si todo salió bien
                  connection.commit((errCommit) => {
                    // Si falla el commit, revierte la transacción
                    if (errCommit) {
                      return connection.rollback(() => {
                        console.error(errCommit);
                        res
                          .status(500)
                          .json({ msg: "Error al confirmar transacción" });
                      });
                    }

                    // Respuesta final de éxito
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
   - Registra un nuevo subdirector desde el panel de administración
   - Por ahora se guarda usando el rol Director
========================================================= */
app.post(
  "/api/admin/registrar-subdirector",
  auth,
  requireRole("administrador"),
  (req, res) => {
    // Extrae los datos enviados en el body
    const { nombre, email, telefono, password } = req.body;

    // Valida que no falten datos obligatorios
    if (!nombre || !email || !telefono || !password) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    // Verifica si ya existe un usuario con ese correo
    existeUsuarioPorEmail(email, (errEmail, existeEmail) => {
      if (errEmail) {
        console.error(errEmail);
        return res.status(500).json({ msg: "Error al validar email" });
      }

      // Si el correo ya existe, detiene el registro
      if (existeEmail) {
        return res
          .status(400)
          .json({ msg: "Ya existe un usuario con ese correo" });
      }

      // Obtiene el id del rol Director, que temporalmente se usa para subdirector
      obtenerIdRolPorNombre("Director", (errRol, idRolDirector) => {
        if (errRol) {
          console.error(errRol);
          return res.status(500).json({
            msg: "No se encontró el rol Director para guardar el subdirector",
          });
        }

        /* =========================================================
           CONSULTA SQL
           - Inserta el nuevo usuario en la tabla usuario
           - Guarda nombre, password, idRol, teléfono, email y estatus
           - En este caso el idRol corresponde a Director
           - El estatus se registra como 'activo'
        ========================================================= */
        const sqlUsuario = `
          INSERT INTO usuario (nombre, password, idRol, telefono, email, estatus)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        // Ejecuta el insert del nuevo usuario
        connection.query(
          sqlUsuario,
          [nombre, password, idRolDirector, telefono, email, "activo"],
          (errUser) => {
            // Si ocurre un error al insertar, responde con estado 500
            if (errUser) {
              console.error(errUser);
              return res
                .status(500)
                .json({ msg: "Error al crear subdirector" });
            }

            // Si todo sale bien, responde con mensaje de éxito
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
   ADMIN - OBTENER UN USUARIO POR TIPO
   - Busca un usuario específico según el tipo enviado en la URL
   - Se usa para cargar la información en el modal de editar
========================================================= */
app.get(
  "/api/admin/usuarios/:tipo/:idusuario",
  auth,
  requireRole("administrador"),
  (req, res) => {
    // Obtiene tipo e idusuario desde los parámetros de la URL
    const { tipo, idusuario } = req.params;

    // Normaliza el tipo a minúsculas para compararlo sin problemas
    const tipoNormalizado = String(tipo || "").toLowerCase();

    // Convierte el idusuario a número
    const id = Number(idusuario);

    // Valida que el tipo esté dentro de los permitidos
    if (!tipoAdminValido(tipoNormalizado)) {
      return res.status(400).json({ msg: "Tipo de usuario inválido" });
    }

    // Valida que el id sea válido
    if (!id) {
      return res.status(400).json({ msg: "ID de usuario inválido" });
    }

    // Variables para guardar la consulta y sus parámetros
    let sql = "";
    let params = [id];

    // Si el tipo es alumno, busca datos en alumno + usuario
    if (tipoNormalizado === "alumno") {
      /* =========================================================
         CONSULTA SQL
         - Obtiene los datos del alumno a partir de idusuario
         - Une alumno con usuario para traer matrícula, grupo,
           nombre, email, teléfono y estatus
         - LIMIT 1 asegura un solo resultado
      ========================================================= */
      sql = `
        SELECT
          u.idusuario,
          a.matricula,
          a.idgrupo,
          u.nombre,
          u.email,
          u.telefono,
          u.estatus
        FROM alumno a
        INNER JOIN usuario u ON a.idusuario = u.idusuario
        WHERE u.idusuario = ?
        LIMIT 1
      `;
    } else if (tipoNormalizado === "tutor") {
      /* =========================================================
         CONSULTA SQL
         - Obtiene los datos del tutor a partir de idusuario
         - Une tutor con usuario para traer nombre, email,
           teléfono y estatus
         - LIMIT 1 asegura un solo resultado
      ========================================================= */
      sql = `
        SELECT
          u.idusuario,
          u.nombre,
          u.email,
          u.telefono,
          u.estatus
        FROM tutor t
        INNER JOIN usuario u ON t.idusuario = u.idusuario
        WHERE u.idusuario = ?
        LIMIT 1
      `;
    } else if (tipoNormalizado === "responsable") {
      /* =========================================================
         CONSULTA SQL
         - Obtiene los datos del responsable a partir de idusuario
         - Une responsable con usuario para traer nombre, email,
           teléfono, estatus y ubicación
         - LIMIT 1 asegura un solo resultado
      ========================================================= */
      sql = `
        SELECT
          u.idusuario,
          u.nombre,
          u.email,
          u.telefono,
          u.estatus,
          r.ubicacion
        FROM responsable r
        INNER JOIN usuario u ON r.idusuario = u.idusuario
        WHERE u.idusuario = ?
        LIMIT 1
      `;
    } else if (tipoNormalizado === "subdirector") {
      /* =========================================================
         CONSULTA SQL
         - Obtiene los datos del subdirector a partir de idusuario
         - Por ahora se identifica como usuario con rol Director
         - Une usuario con rol para validar ese rol
         - LIMIT 1 asegura un solo resultado
      ========================================================= */
      sql = `
        SELECT
          u.idusuario,
          u.nombre,
          u.email,
          u.telefono,
          u.estatus
        FROM usuario u
        INNER JOIN rol r ON u.idRol = r.idRol
        WHERE u.idusuario = ?
          AND LOWER(r.nombreRol) = 'director'
        LIMIT 1
      `;
    }

    // Ejecuta la consulta según el tipo de usuario
    connection.query(sql, params, (err, results) => {
      // Si hay error en la consulta, responde con estado 500
      if (err) {
        console.error(err);
        return res.status(500).json({ msg: "Error al obtener usuario" });
      }

      // Si no encontró registros, responde con 404
      if (!results || results.length === 0) {
        return res.status(404).json({ msg: "Usuario no encontrado" });
      }

      // Si todo sale bien, devuelve el primer resultado
      res.json(results[0]);
    });
  },
);

/* =========================================================
   ADMIN - EDITAR USUARIO POR TIPO
   - Actualiza los datos de un usuario según su tipo
   - password es opcional en edición
   - alumno también actualiza matrícula y grupo
   - responsable también actualiza ubicación
========================================================= */
app.put(
  "/api/admin/usuarios/:tipo/:idusuario",
  auth,
  requireRole("administrador"),
  (req, res) => {
    // Obtiene tipo e idusuario desde la URL
    const { tipo, idusuario } = req.params;

    // Normaliza el tipo para compararlo más fácil
    const tipoNormalizado = String(tipo || "").toLowerCase();

    // Convierte el id a número
    const id = Number(idusuario);

    // Obtiene los datos enviados en el body
    let {
      matricula,
      idgrupo,
      nombre,
      email,
      telefono,
      password,
      estatus,
      ubicacion,
    } = req.body;

    // Valida que el tipo sea correcto
    if (!tipoAdminValido(tipoNormalizado)) {
      return res.status(400).json({ msg: "Tipo de usuario inválido" });
    }

    // Valida que el id sea válido
    if (!id) {
      return res.status(400).json({ msg: "ID de usuario inválido" });
    }

    // Valida datos obligatorios generales
    if (!nombre || !email || !telefono || !estatus) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    // Normaliza el estatus a minúsculas
    estatus = String(estatus).toLowerCase();

    // Valida que el estatus esté permitido
    if (!estatusValido(estatus)) {
      return res.status(400).json({ msg: "Estatus inválido" });
    }

    /* =========================================================
       CONSULTA SQL
       - Verifica si ya existe otro usuario con el mismo email
       - Excluye al usuario actual usando idusuario <> ?
    ========================================================= */
    const sqlExisteEmail = `
      SELECT idusuario
      FROM usuario
      WHERE email = ? AND idusuario <> ?
      LIMIT 1
    `;

    // Valida que el email no esté repetido en otro usuario
    connection.query(sqlExisteEmail, [email, id], (errEmail, resultEmail) => {
      if (errEmail) {
        console.error(errEmail);
        return res.status(500).json({ msg: "Error al validar email" });
      }

      // Si ya existe otro usuario con ese correo, detiene el proceso
      if (resultEmail && resultEmail.length > 0) {
        return res
          .status(400)
          .json({ msg: "Ya existe otro usuario con ese correo" });
      }

      // Inicia transacción para asegurar consistencia en los cambios
      connection.beginTransaction((errTx) => {
        if (errTx) {
          console.error(errTx);
          return res.status(500).json({ msg: "Error al iniciar transacción" });
        }

        // Función auxiliar para hacer rollback y responder error
        const rollbackError = (err, msg) =>
          connection.rollback(() => {
            console.error(err);
            res.status(500).json({ msg });
          });

        /* =========================================================
           FUNCIÓN AUXILIAR
           - Actualiza los datos base de la tabla usuario
           - Si viene password con valor, también la actualiza
        ========================================================= */
        const actualizarUsuarioBase = (callback) => {
          /* =========================================================
             CONSULTA SQL
             - Actualiza nombre, email, teléfono y estatus
             - password solo se agrega si fue enviada
          ========================================================= */
          let sqlUsuario = `
            UPDATE usuario
            SET
              nombre = ?,
              email = ?,
              telefono = ?,
              estatus = ?
          `;
          const paramsUsuario = [nombre, email, telefono, estatus];

          // Si se envió password, también se actualiza
          if (password && String(password).trim() !== "") {
            sqlUsuario += `, password = ?`;
            paramsUsuario.push(String(password).trim());
          }

          // Agrega la condición final por idusuario
          sqlUsuario += ` WHERE idusuario = ?`;
          paramsUsuario.push(id);

          // Ejecuta el update de usuario
          connection.query(sqlUsuario, paramsUsuario, (errUser, resultUser) => {
            if (errUser) {
              return rollbackError(errUser, "Error al actualizar usuario");
            }

            // Si no afectó filas, el usuario no existe
            if (!resultUser || resultUser.affectedRows === 0) {
              return connection.rollback(() => {
                res.status(404).json({ msg: "Usuario no encontrado" });
              });
            }

            callback();
          });
        };

        /* =========================================================
           EDICIÓN DE ALUMNO
           - Además de usuario, actualiza matrícula e idgrupo
        ========================================================= */
        if (tipoNormalizado === "alumno") {
          // Para alumno, matrícula e idgrupo son obligatorios
          if (!matricula || !idgrupo) {
            return connection.rollback(() => {
              res
                .status(400)
                .json({ msg: "Matrícula e idgrupo son obligatorios" });
            });
          }

          /* =========================================================
             CONSULTA SQL
             - Verifica que el alumno exista en la tabla alumno
          ========================================================= */
          const sqlExisteAlumno = `
            SELECT idusuario
            FROM alumno
            WHERE idusuario = ?
            LIMIT 1
          `;

          connection.query(sqlExisteAlumno, [id], (errAlumno, resultAlumno) => {
            if (errAlumno) {
              return rollbackError(errAlumno, "Error al validar alumno");
            }

            if (!resultAlumno || resultAlumno.length === 0) {
              return connection.rollback(() => {
                res.status(404).json({ msg: "Alumno no encontrado" });
              });
            }

            /* =========================================================
               CONSULTA SQL
               - Verifica que la matrícula no esté usada por otro alumno
            ========================================================= */
            const sqlMatricula = `
              SELECT idusuario
              FROM alumno
              WHERE matricula = ? AND idusuario <> ?
              LIMIT 1
            `;

            connection.query(
              sqlMatricula,
              [matricula, id],
              (errMat, resultMat) => {
                if (errMat) {
                  return rollbackError(
                    errMat,
                    "Error al validar matrícula del alumno",
                  );
                }

                if (resultMat && resultMat.length > 0) {
                  return connection.rollback(() => {
                    res
                      .status(400)
                      .json({ msg: "La matrícula ya está registrada" });
                  });
                }

                /* =========================================================
                   CONSULTA SQL
                   - Verifica que el grupo exista
                ========================================================= */
                const sqlGrupo = `
                  SELECT idgrupo
                  FROM grupo
                  WHERE idgrupo = ?
                  LIMIT 1
                `;

                connection.query(
                  sqlGrupo,
                  [idgrupo],
                  (errGrupo, resultGrupo) => {
                    if (errGrupo) {
                      return rollbackError(errGrupo, "Error al validar grupo");
                    }

                    if (!resultGrupo || resultGrupo.length === 0) {
                      return connection.rollback(() => {
                        res
                          .status(400)
                          .json({ msg: "El grupo seleccionado no existe" });
                      });
                    }

                    // Primero actualiza los datos base del usuario
                    actualizarUsuarioBase(() => {
                      /* =========================================================
                         CONSULTA SQL
                         - Actualiza matrícula e idgrupo en la tabla alumno
                      ========================================================= */
                      const sqlAlumnoUpdate = `
                        UPDATE alumno
                        SET
                          matricula = ?,
                          idgrupo = ?
                        WHERE idusuario = ?
                      `;

                      connection.query(
                        sqlAlumnoUpdate,
                        [matricula, idgrupo, id],
                        (errUpdateAlumno) => {
                          if (errUpdateAlumno) {
                            return rollbackError(
                              errUpdateAlumno,
                              "Error al actualizar alumno",
                            );
                          }

                          // Confirma la transacción
                          connection.commit((errCommit) => {
                            if (errCommit) {
                              return rollbackError(
                                errCommit,
                                "Error al confirmar transacción",
                              );
                            }

                            res.json({
                              success: true,
                              msg: "Alumno actualizado correctamente",
                            });
                          });
                        },
                      );
                    });
                  },
                );
              },
            );
          });
        } else if (tipoNormalizado === "tutor") {
          /* =========================================================
           EDICIÓN DE TUTOR
           - Solo actualiza los datos base en usuario
        ========================================================= */
          /* =========================================================
             CONSULTA SQL
             - Verifica que el tutor exista en la tabla tutor
          ========================================================= */
          const sqlExisteTutor = `
            SELECT idusuario
            FROM tutor
            WHERE idusuario = ?
            LIMIT 1
          `;

          connection.query(sqlExisteTutor, [id], (errTutor, resultTutor) => {
            if (errTutor) {
              return rollbackError(errTutor, "Error al validar tutor");
            }

            if (!resultTutor || resultTutor.length === 0) {
              return connection.rollback(() => {
                res.status(404).json({ msg: "Tutor no encontrado" });
              });
            }

            // Actualiza los datos base del usuario
            actualizarUsuarioBase(() => {
              connection.commit((errCommit) => {
                if (errCommit) {
                  return rollbackError(
                    errCommit,
                    "Error al confirmar transacción",
                  );
                }

                res.json({
                  success: true,
                  msg: "Tutor actualizado correctamente",
                });
              });
            });
          });
        } else if (tipoNormalizado === "responsable") {
          /* =========================================================
           EDICIÓN DE RESPONSABLE
           - Actualiza datos base y también la ubicación
        ========================================================= */
          /* =========================================================
             CONSULTA SQL
             - Verifica que el responsable exista en la tabla responsable
          ========================================================= */
          const sqlExisteResponsable = `
            SELECT idusuario
            FROM responsable
            WHERE idusuario = ?
            LIMIT 1
          `;

          connection.query(
            sqlExisteResponsable,
            [id],
            (errResp, resultResp) => {
              if (errResp) {
                return rollbackError(errResp, "Error al validar responsable");
              }

              if (!resultResp || resultResp.length === 0) {
                return connection.rollback(() => {
                  res.status(404).json({ msg: "Responsable no encontrado" });
                });
              }

              // Primero actualiza los datos base del usuario
              actualizarUsuarioBase(() => {
                /* =========================================================
                   CONSULTA SQL
                   - Actualiza la ubicación del responsable
                   - Si no se envía ubicación, usa "No especificada"
                ========================================================= */
                const sqlRespUpdate = `
                  UPDATE responsable
                  SET ubicacion = ?
                  WHERE idusuario = ?
                `;

                connection.query(
                  sqlRespUpdate,
                  [ubicacion || "No especificada", id],
                  (errUpdateResp) => {
                    if (errUpdateResp) {
                      return rollbackError(
                        errUpdateResp,
                        "Error al actualizar responsable",
                      );
                    }

                    connection.commit((errCommit) => {
                      if (errCommit) {
                        return rollbackError(
                          errCommit,
                          "Error al confirmar transacción",
                        );
                      }

                      res.json({
                        success: true,
                        msg: "Responsable actualizado correctamente",
                      });
                    });
                  },
                );
              });
            },
          );
        } else if (tipoNormalizado === "subdirector") {
          /* =========================================================
           EDICIÓN DE SUBDIRECTOR
           - Por ahora valida usuarios con rol Director
           - Solo actualiza los datos base en usuario
        ========================================================= */
          /* =========================================================
             CONSULTA SQL
             - Verifica que el usuario exista y tenga rol Director
             - Temporalmente así se identifica al subdirector
          ========================================================= */
          const sqlExisteSubdirector = `
            SELECT u.idusuario
            FROM usuario u
            INNER JOIN rol r ON u.idRol = r.idRol
            WHERE u.idusuario = ?
              AND LOWER(r.nombreRol) = 'director'
            LIMIT 1
          `;

          connection.query(sqlExisteSubdirector, [id], (errSub, resultSub) => {
            if (errSub) {
              return rollbackError(errSub, "Error al validar subdirector");
            }

            if (!resultSub || resultSub.length === 0) {
              return connection.rollback(() => {
                res.status(404).json({ msg: "Subdirector no encontrado" });
              });
            }

            // Actualiza los datos base del usuario
            actualizarUsuarioBase(() => {
              connection.commit((errCommit) => {
                if (errCommit) {
                  return rollbackError(
                    errCommit,
                    "Error al confirmar transacción",
                  );
                }

                res.json({
                  success: true,
                  msg: "Subdirector actualizado correctamente",
                });
              });
            });
          });
        }
      });
    });
  },
);

/* =========================================================
   ADMIN - CAMBIAR ESTATUS DE USUARIO POR TIPO
   - Esta ruta permite cambiar el estatus de un usuario
     sin eliminarlo físicamente de la base de datos
   - Funciona como una "baja lógica"
   - Los estatus permitidos son:
       * activo
       * inactivo
       * baja_temporal
   - Primero valida el tipo de usuario
   - Después valida que el usuario exista en su tabla
   - Finalmente actualiza el campo estatus en la tabla usuario
========================================================= */
app.put(
  "/api/admin/usuarios/:tipo/:idusuario/estatus",
  auth,
  requireRole("administrador"),
  (req, res) => {
    /* =========================================================
       OBTENER DATOS DE LA PETICIÓN
       - tipo e idusuario vienen en la URL
       - estatus viene en el body
    ========================================================= */
    const { tipo, idusuario } = req.params;
    let { estatus } = req.body;

    /* =========================================================
       NORMALIZACIÓN DE DATOS
       - tipoNormalizado convierte el tipo a minúsculas
         para compararlo sin errores
       - id convierte idusuario a número
    ========================================================= */
    const tipoNormalizado = String(tipo || "").toLowerCase();
    const id = Number(idusuario);

    /* =========================================================
       VALIDAR TIPO DE USUARIO
       - Se revisa que el tipo recibido sea válido
       - Los tipos válidos son:
         alumno, tutor, responsable, subdirector
    ========================================================= */
    if (!tipoAdminValido(tipoNormalizado)) {
      return res.status(400).json({ msg: "Tipo de usuario inválido" });
    }

    /* =========================================================
       VALIDAR ID DE USUARIO
       - Si el id no existe o no es válido, se detiene el proceso
    ========================================================= */
    if (!id) {
      return res.status(400).json({ msg: "ID de usuario inválido" });
    }

    /* =========================================================
       NORMALIZAR ESTATUS
       - Convierte el estatus a texto y minúsculas
       - Así evita problemas si llega como "Activo" o "ACTIVO"
    ========================================================= */
    estatus = String(estatus || "").toLowerCase();

    /* =========================================================
       VALIDAR ESTATUS
       - Se revisa que el nuevo estatus esté dentro
         de los valores permitidos
    ========================================================= */
    if (!estatusValido(estatus)) {
      return res.status(400).json({ msg: "Estatus inválido" });
    }

    /* =========================================================
       CONSULTA DE VALIDACIÓN SEGÚN EL TIPO
       - Aquí no se actualiza nada todavía
       - Primero se arma una consulta para comprobar
         que el usuario realmente exista en la tabla
         correspondiente a su tipo
    ========================================================= */
    let sqlValidacion = "";

    if (tipoNormalizado === "alumno") {
      /* =========================================================
         CONSULTA SQL
         - Verifica que el usuario exista en la tabla alumno
         - Busca por idusuario
         - LIMIT 1 asegura un solo resultado
      ========================================================= */
      sqlValidacion = `
        SELECT a.idusuario
        FROM alumno a
        WHERE a.idusuario = ?
        LIMIT 1
      `;
    } else if (tipoNormalizado === "tutor") {
      /* =========================================================
         CONSULTA SQL
         - Verifica que el usuario exista en la tabla tutor
      ========================================================= */
      sqlValidacion = `
        SELECT t.idusuario
        FROM tutor t
        WHERE t.idusuario = ?
        LIMIT 1
      `;
    } else if (tipoNormalizado === "responsable") {
      /* =========================================================
         CONSULTA SQL
         - Verifica que el usuario exista en la tabla responsable
      ========================================================= */
      sqlValidacion = `
        SELECT r.idusuario
        FROM responsable r
        WHERE r.idusuario = ?
        LIMIT 1
      `;
    } else if (tipoNormalizado === "subdirector") {
      /* =========================================================
         CONSULTA SQL
         - Verifica que el usuario exista en la tabla usuario
         - Además valida que tenga rol Director
         - Esto porque actualmente subdirector se guarda
           temporalmente como Director
      ========================================================= */
      sqlValidacion = `
        SELECT u.idusuario
        FROM usuario u
        INNER JOIN rol r ON u.idRol = r.idRol
        WHERE u.idusuario = ?
          AND LOWER(r.nombreRol) = 'director'
        LIMIT 1
      `;
    }

    /* =========================================================
       EJECUTAR VALIDACIÓN
       - Se ejecuta la consulta armada arriba
       - Si falla la consulta, responde error 500
       - Si no encuentra usuario, responde 404
    ========================================================= */
    connection.query(sqlValidacion, [id], (errVal, resultVal) => {
      if (errVal) {
        console.error(errVal);
        return res.status(500).json({ msg: "Error al validar usuario" });
      }

      if (!resultVal || resultVal.length === 0) {
        return res.status(404).json({ msg: "Usuario no encontrado" });
      }

      /* =========================================================
         CONSULTA SQL
         - Actualiza el campo estatus en la tabla usuario
         - Se hace por idusuario
      ========================================================= */
      const sqlUpdate = `
        UPDATE usuario
        SET estatus = ?
        WHERE idusuario = ?
      `;

      /* =========================================================
         EJECUTAR UPDATE
         - Si hay error en la actualización, responde 500
         - Si no afecta filas, responde 404
         - Si todo sale bien, responde éxito
      ========================================================= */
      connection.query(sqlUpdate, [estatus, id], (errUpdate, resultUpdate) => {
        if (errUpdate) {
          console.error(errUpdate);
          return res.status(500).json({ msg: "Error al actualizar estatus" });
        }

        if (!resultUpdate || resultUpdate.affectedRows === 0) {
          return res.status(404).json({ msg: "Usuario no encontrado" });
        }

        /* =========================================================
           RESPUESTA FINAL
           - Indica que el cambio de estatus se realizó correctamente
        ========================================================= */
        res.json({
          success: true,
          msg: "Estatus actualizado correctamente",
        });
      });
    });
  },
);

/* =========================================================
   GET - OBTENER TODOS LOS GRUPOS PARA ADMIN
   - Esta ruta devuelve el listado completo de grupos
     para el panel de administración
   - Incluye:
       * datos propios del grupo
       * tutor asignado si existe
       * fechas de inicio y término de servicio
       * estatus del tutor
   - Solo puede acceder un usuario autenticado
     con rol administrador
========================================================= */
app.get("/api/admin/grupos", auth, requireRole("administrador"), (req, res) => {
  /* =========================================================
     CONSULTA SQL
     - Obtiene todos los grupos registrados en la tabla grupo
     - Usa LEFT JOIN con tutor para relacionar el grupo
       con su tutor asignado, si tiene uno
     - Usa LEFT JOIN con usuario para traer el nombre
       y estatus del tutor
     - LEFT JOIN permite que el grupo siga apareciendo
       aunque todavía no tenga tutor asignado
     - ORDER BY organiza el resultado por idgrupo
       de menor a mayor
  ========================================================= */
  const sql = `
    SELECT
      g.idgrupo,
      g.grupo,
      g.turno,
      g.cuatrimestre,
      g.idtutor,
      g.fecha_inicio_servicio,
      g.fecha_termino_servicio,
      u.nombre AS nombre_tutor,
      u.estatus AS estatus_tutor
    FROM grupo g
    LEFT JOIN tutor t ON g.idtutor = t.idtutor
    LEFT JOIN usuario u ON t.idusuario = u.idusuario
    ORDER BY g.idgrupo ASC
  `;

  /* =========================================================
     EJECUTAR CONSULTA
     - Si ocurre un error al consultar la base de datos,
       responde con estado 500
     - Si todo sale bien, devuelve el arreglo de grupos
       en formato JSON
  ========================================================= */
  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Error al obtener grupos para admin:", err);
      return res.status(500).json({ error: "Error al obtener grupos" });
    }

    /* =========================================================
       RESPUESTA FINAL
       - Envía todos los grupos encontrados
    ========================================================= */
    res.json(results);
  });
});

/* =========================================================
   GET - OBTENER TUTORES ACTIVOS
   - Esta ruta devuelve únicamente los tutores
     que tienen estatus activo
   - Se usa para llenar el select del modal de grupos
   - Solo puede acceder un usuario autenticado
     con rol administrador
========================================================= */
app.get(
  "/api/admin/tutores",
  auth,
  requireRole("administrador"),
  (req, res) => {
    /* =========================================================
       CONSULTA SQL
       - Obtiene los datos principales de los tutores
       - Une la tabla tutor con usuario para traer
         nombre, email, teléfono y estatus
       - Solo muestra los tutores cuyo estatus
         sea 'activo'
       - ORDER BY organiza el resultado por nombre
         en orden alfabético
    ========================================================= */
    const sql = `
      SELECT
        t.idtutor,
        u.idusuario,
        u.nombre,
        u.email,
        u.telefono,
        u.estatus
      FROM tutor t
      INNER JOIN usuario u ON t.idusuario = u.idusuario
      WHERE u.estatus = 'activo'
      ORDER BY u.nombre ASC
    `;

    /* =========================================================
       EJECUTAR CONSULTA
       - Si ocurre un error al consultar la base de datos,
         responde con estado 500
       - Si todo sale bien, devuelve el listado de tutores
         activos en formato JSON
    ========================================================= */
    connection.query(sql, (err, results) => {
      if (err) {
        console.error("Error al obtener tutores para admin:", err);
        return res.status(500).json({ error: "Error al obtener tutores" });
      }

      /* =========================================================
         RESPUESTA FINAL
         - Envía el arreglo de tutores activos
      ========================================================= */
      res.json(results);
    });
  },
);

/* =========================================================
   PUT - ACTUALIZAR CONFIGURACIÓN DE UN GRUPO
   - Esta ruta permite modificar la configuración general
     de un grupo desde el panel de administración
   - Se puede:
       * asignar o cambiar tutor
       * quitar tutor dejando null
       * definir fecha_inicio_servicio
       * definir fecha_termino_servicio
       * cambiar turno
   - Antes de actualizar:
       * valida que el grupo exista
       * valida que el turno sea correcto
       * valida el orden de las fechas
       * valida que el tutor exista y esté activo, si se envía uno
========================================================= */
app.put(
  "/api/admin/grupos/:id",
  auth,
  requireRole("administrador"),
  (req, res) => {
    /* =========================================================
       OBTENER DATOS DE LA PETICIÓN
       - id viene en los parámetros de la URL
       - idtutor, fechas y turno vienen en el body
    ========================================================= */
    const { id } = req.params;
    let { idtutor, fecha_inicio_servicio, fecha_termino_servicio, turno } =
      req.body;

    // Convierte el id del grupo a número
    const idgrupo = Number(id);

    /* =========================================================
       VALIDAR ID DEL GRUPO
       - Si el id no es válido, se detiene el proceso
    ========================================================= */
    if (!idgrupo) {
      return res.status(400).json({ msg: "ID de grupo inválido" });
    }

    /* =========================================================
       VALIDAR TURNO
       - Se revisa que se haya enviado un turno
       - También se valida que sea uno de los permitidos:
         Matutino o Vespertino
    ========================================================= */
    if (!turno || !turnoValido(turno)) {
      return res.status(400).json({
        msg: "Turno inválido. Solo se permite Matutino o Vespertino",
      });
    }

    /* =========================================================
       NORMALIZAR IDTUTOR
       - Si viene vacío o undefined, se convierte a null
         para indicar que el grupo no tendrá tutor asignado
       - Si sí viene un valor, se convierte a número
    ========================================================= */
    if (idtutor === "" || idtutor === undefined) {
      idtutor = null;
    } else if (idtutor !== null) {
      idtutor = Number(idtutor);
    }

    /* =========================================================
       NORMALIZAR FECHAS
       - Si las fechas vienen como cadena vacía, se convierten
         a null para evitar guardar texto vacío en la base
    ========================================================= */
    if (fecha_inicio_servicio === "") fecha_inicio_servicio = null;
    if (fecha_termino_servicio === "") fecha_termino_servicio = null;

    /* =========================================================
       VALIDAR ORDEN DE FECHAS
       - Si ambas fechas existen, la fecha de término
         no puede ser menor que la fecha de inicio
    ========================================================= */
    if (
      fecha_inicio_servicio &&
      fecha_termino_servicio &&
      fecha_termino_servicio < fecha_inicio_servicio
    ) {
      return res.status(400).json({
        msg: "La fecha de término no puede ser menor que la fecha de inicio",
      });
    }

    /* =========================================================
       CONSULTA SQL
       - Verifica que el grupo exista en la tabla grupo
       - Busca por idgrupo
       - LIMIT 1 asegura un solo resultado
    ========================================================= */
    const sqlGrupo = `
      SELECT idgrupo
      FROM grupo
      WHERE idgrupo = ?
      LIMIT 1
    `;

    /* =========================================================
       VALIDAR EXISTENCIA DEL GRUPO
       - Si hay error en la consulta, responde con 500
       - Si no existe el grupo, responde con 404
       - Si existe, continúa con la validación del tutor
         o directamente con la actualización
    ========================================================= */
    connection.query(sqlGrupo, [idgrupo], (errGrupo, resultGrupo) => {
      if (errGrupo) {
        console.error(errGrupo);
        return res.status(500).json({ msg: "Error al validar grupo" });
      }

      if (!resultGrupo || resultGrupo.length === 0) {
        return res.status(404).json({ msg: "Grupo no encontrado" });
      }

      /* =========================================================
         VALIDAR TUTOR SOLO SI SE ENVIÓ UNO
         - Si idtutor no es null, se revisa que exista
           y que además esté activo
         - Si idtutor es null, se salta esta validación
           y se actualiza el grupo directamente
      ========================================================= */
      if (idtutor !== null) {
        /* =========================================================
           CONSULTA SQL
           - Busca el tutor por su id
           - Une con usuario para validar que el tutor
             tenga estatus 'activo'
           - Solo permite asignar tutores activos
        ========================================================= */
        const sqlTutor = `
          SELECT t.idtutor
          FROM tutor t
          INNER JOIN usuario u ON t.idusuario = u.idusuario
          WHERE t.idtutor = ?
            AND u.estatus = 'activo'
          LIMIT 1
        `;

        connection.query(sqlTutor, [idtutor], (errTutor, resultTutor) => {
          if (errTutor) {
            console.error(errTutor);
            return res.status(500).json({ msg: "Error al validar tutor" });
          }

          if (!resultTutor || resultTutor.length === 0) {
            return res.status(404).json({
              msg: "Tutor no encontrado o está inactivo",
            });
          }

          // Si el tutor es válido, continúa con la actualización
          actualizarGrupo();
        });
      } else {
        // Si no se envió tutor, actualiza directamente el grupo
        actualizarGrupo();
      }

      /* =========================================================
         FUNCIÓN ACTUALIZAR GRUPO
         - Se encarga de ejecutar el UPDATE final
         - Guarda turno, tutor y fechas
      ========================================================= */
      function actualizarGrupo() {
        /* =========================================================
           CONSULTA SQL
           - Actualiza la tabla grupo
           - Modifica:
               * turno
               * idtutor
               * fecha_inicio_servicio
               * fecha_termino_servicio
           - Se aplica al grupo indicado por idgrupo
        ========================================================= */
        const sqlUpdate = `
          UPDATE grupo
          SET
            turno = ?,
            idtutor = ?,
            fecha_inicio_servicio = ?,
            fecha_termino_servicio = ?
          WHERE idgrupo = ?
        `;

        /* =========================================================
           EJECUTAR ACTUALIZACIÓN
           - Si hay error en el update, responde 500
           - Si no afecta filas, responde 404
           - Si todo sale bien, responde éxito
        ========================================================= */
        connection.query(
          sqlUpdate,
          [
            turno,
            idtutor,
            fecha_inicio_servicio,
            fecha_termino_servicio,
            idgrupo,
          ],
          (errUpdate, resultUpdate) => {
            if (errUpdate) {
              console.error(errUpdate);
              return res.status(500).json({ msg: "Error al actualizar grupo" });
            }

            if (resultUpdate.affectedRows === 0) {
              return res.status(404).json({ msg: "Grupo no encontrado" });
            }

            /* =========================================================
               RESPUESTA FINAL
               - Indica que el grupo fue actualizado correctamente
            ========================================================= */
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
   - Esta ruta devuelve el listado general de grupos
   - Si el usuario es Director, puede ver todos los grupos
   - Si el usuario es Tutor, solo puede ver los grupos
     que tiene asignados
   - También calcula:
       * total de alumnos por grupo
       * alumnos completados
       * alumnos no completados
========================================================= */
app.get("/api/grupos", auth, requireRole("director", "tutor"), (req, res) => {
  /* =========================================================
     OBTENER DATOS DEL USUARIO AUTENTICADO
     - req.user viene del middleware auth
     - rol indica si el usuario es director o tutor
     - idusuario sirve para filtrar los grupos del tutor
  ========================================================= */
  const { rol, idusuario } = req.user;

  /* =========================================================
     VARIABLES PARA ARMAR EL FILTRO DINÁMICO
     - filtroSQL guardará una parte del WHERE si aplica
     - parametros guardará los valores que se mandan
       a la consulta para evitar inyección SQL
  ========================================================= */
  let filtroSQL = "";
  let parametros = [];

  /* =========================================================
     FILTRO SEGÚN EL ROL
     - Si el usuario es tutor, solo debe ver sus grupos
     - Para eso se filtra con el idusuario del tutor logueado
     - Si es director, no se agrega filtro y verá todos
  ========================================================= */
  if (rol.toLowerCase() === "tutor") {
    filtroSQL = "WHERE t.idusuario = ?";
    parametros.push(idusuario);
  }

  /* =========================================================
     CONSULTA SQL
     - Obtiene los datos principales de cada grupo
     - Une con tutor y usuario para traer el nombre del tutor
     - Une con alumno para contar cuántos alumnos hay en cada grupo
     - Usa una subconsulta para sumar las horas de tareas
       por matrícula
     - Con esas horas calcula:
         * completados: alumnos con 480 horas o más
         * no_completados: alumnos con menos de 480 horas
           o sin horas registradas
     - GROUP BY agrupa la información por grupo
     - ORDER BY ordena los grupos por id
  ========================================================= */
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

  /* =========================================================
     DETALLE DE LA SUBCONSULTA "sub"
     - Toma la tabla asignacion_actividad para identificar
       en qué actividades participa cada alumno
     - Une con tareas_actividad para sumar las horas
       de las tareas asociadas a esas actividades
     - Agrupa por matrícula para obtener el total de horas
       acumuladas por cada alumno
  ========================================================= */

  /* =========================================================
     EJECUTAR CONSULTA
     - Usa la consulta SQL y los parámetros definidos antes
     - Si el usuario es tutor, parametros tendrá su idusuario
     - Si es director, parametros irá vacío
  ========================================================= */
  connection.query(sql, parametros, (err, results) => {
    /* =========================================================
       MANEJO DE ERROR
       - Si ocurre un error en la base de datos,
         responde con estado 500
    ========================================================= */
    if (err) {
      console.error("Error en SQL:", err);
      return res.status(500).json({ error: "Error en DB" });
    }

    /* =========================================================
       RESPUESTA FINAL
       - Devuelve el listado de grupos en formato JSON
       - Cada grupo incluye sus estadísticas calculadas
    ========================================================= */
    res.json(results);
  });
});

/* =========================================================
   CONSULTA FILTRADA DE ALUMNOS POR GRUPO
   - Esta ruta obtiene todos los alumnos que pertenecen
     a un grupo específico
   - El id del grupo se recibe por query string, por ejemplo:
       /api/alumnos-grupo?id=3
   - Además de los datos del alumno, también calcula:
       * horas liberadas
       * actividades asignadas
       * estatus de cada actividad
========================================================= */
app.get("/api/alumnos-grupo", auth, (req, res) => {
  /* =========================================================
     OBTENER EL ID DEL GRUPO DESDE LA URL
     - req.query.id toma el valor enviado en el query string
     - Ejemplo:
       /api/alumnos-grupo?id=3
       entonces idgrupo = 3
  ========================================================= */
  const idgrupo = req.query.id;

  /* =========================================================
     VALIDAR QUE SE HAYA ENVIADO EL ID DEL GRUPO
     - Si no viene, se responde con error 400
  ========================================================= */
  if (!idgrupo) {
    return res.status(400).json({ error: "Falta el id del grupo" });
  }

  /* =========================================================
     CONSULTA SQL PRINCIPAL
     - Obtiene los datos base de todos los alumnos
       que pertenecen al grupo indicado
     - Trae:
         * matrícula
         * nombre
         * email
         * teléfono
         * foto de perfil
         * nombre del grupo
         * horas liberadas
     - Las horas liberadas se calculan con una subconsulta
       llamada "sub"
     - Solo suma horas de tareas cuyo estatus sea 'Cumplida'
     - ORDER BY ordena los alumnos alfabéticamente por nombre
  ========================================================= */
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

  /* =========================================================
     DETALLE DE LA SUBCONSULTA "sub"
     - Toma la matrícula de cada alumno desde asignacion_actividad
     - Une con cumplimientotarea para revisar el estatus
       de cada tarea
     - Une con tareas_actividad para conocer las horas
       de cada tarea
     - Solo suma las horas de las tareas con estatus 'Cumplida'
     - Agrupa por matrícula para obtener el total por alumno
  ========================================================= */

  /* =========================================================
     EJECUTAR CONSULTA PRINCIPAL
     - Se envía el id del grupo como parámetro
     - El callback es async porque después se usará await
       con Promise.all para consultar las actividades
       de cada alumno
  ========================================================= */
  connection.query(sql, [idgrupo], async (err, results) => {
    /* =========================================================
       MANEJO DE ERROR EN LA CONSULTA PRINCIPAL
       - Si falla la consulta, responde con error 500
    ========================================================= */
    if (err) {
      console.error("Error al obtener alumnos del grupo:", err);
      return res.status(500).json({ error: err.message });
    }

    try {
      /* =========================================================
         OBTENER ACTIVIDADES DE CADA ALUMNO
         - results contiene todos los alumnos del grupo
         - map recorre cada alumno
         - por cada alumno se crea una Promise para consultar
           sus actividades
         - Promise.all espera a que todas las consultas terminen
         - Al final se obtiene un nuevo arreglo donde cada alumno
           ya incluye su lista de actividades
      ========================================================= */
      const alumnosConActividades = await Promise.all(
        results.map((alumno) => {
          return new Promise((resolve, reject) => {
            /* =========================================================
               CONSULTA SQL DE ACTIVIDADES POR ALUMNO
               - Obtiene las actividades en las que está asignado
                 un alumno específico
               - Trae:
                   * id de la actividad
                   * nombre de la actividad
                   * horas totales del proyecto
                   * horas cumplidas por el alumno
               - Las horas cumplidas solo suman tareas
                 con estatus 'Cumplida'
               - GROUP BY agrupa por actividad
               - ORDER BY ordena alfabéticamente por nombre
            ========================================================= */
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

            /* =========================================================
               EJECUTAR CONSULTA DE ACTIVIDADES
               - Usa la matrícula del alumno actual
               - Si ocurre error, la Promise se rechaza
               - Si sale bien, se transforman los resultados
                 al formato que necesita el frontend
            ========================================================= */
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

                /* =========================================================
                   TRANSFORMAR LAS ACTIVIDADES
                   - map recorre cada actividad encontrada
                   - horasCumplidas convierte el valor a número
                   - horasProyecto toma el total de horas requeridas
                   - estatus se calcula así:
                       * "completada" si las horas cumplidas
                         son mayores o iguales al total del proyecto
                       * "en proceso" si todavía no llega al total
                ========================================================= */
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

                /* =========================================================
                   RESOLVER LA PROMESA
                   - Devuelve un nuevo objeto con todos los datos
                     originales del alumno
                   - Además agrega la propiedad actividades
                ========================================================= */
                resolve({
                  ...alumno,
                  actividades,
                });
              },
            );
          });
        }),
      );

      /* =========================================================
         RESPUESTA FINAL
         - Devuelve el arreglo completo de alumnos
         - Cada alumno incluye su información general
           y sus actividades
      ========================================================= */
      res.json(alumnosConActividades);
    } catch (error) {
      /* =========================================================
         MANEJO DE ERROR GENERAL
         - Si falla cualquiera de las Promises o el procesamiento,
           responde con error 500
      ========================================================= */
      console.error("Error procesando actividades:", error);
      res.status(500).json({ error: "Error procesando actividades" });
    }
  });
});

/* =========================================================
   POST - INICIAR SESIÓN (LOGIN)
   - Esta ruta permite autenticar a un usuario en el sistema
   - Recibe email y password desde el frontend
   - Busca al usuario en la base de datos junto con su rol
   - Valida que el usuario exista y que su estatus sea activo
   - Si todo es correcto, genera un token JWT
   - Devuelve el token y algunos datos útiles al frontend
========================================================= */
app.post("/api/login", (req, res) => {
  /* =========================================================
     OBTENER DATOS DEL BODY
     - Se extraen email y password enviados en la petición
     - Estos datos normalmente vienen desde un formulario login
  ========================================================= */
  const { email, password } = req.body;

  /* =========================================================
     VALIDACIÓN BÁSICA
     - Si falta el correo o la contraseña, no se puede continuar
     - Se responde con error 400 porque faltan datos obligatorios
  ========================================================= */
  if (!email || !password) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  /* =========================================================
     CONSULTA SQL
     - Busca al usuario en la tabla usuario
     - Une con la tabla rol para obtener el nombre del rol
     - Filtra por email y password
     - Trae:
         * idusuario
         * nombre
         * estatus
         * nombreRol
     - LIMIT 1 asegura que solo se obtenga un registro
  ========================================================= */
  const sql = `
    SELECT
      u.idusuario,
      u.nombre,
      u.estatus,
      r.nombreRol
    FROM usuario u
    INNER JOIN rol r ON u.idRol = r.idRol
    WHERE u.email = ? AND u.password = ?
    LIMIT 1
  `;

  /* =========================================================
     EJECUTAR CONSULTA
     - Se ejecuta la consulta usando email y password
       como parámetros
     - Esto busca si existe un usuario con esas credenciales
  ========================================================= */
  connection.query(sql, [email, password], (err, results) => {
    /* =========================================================
       ERROR DE BASE DE DATOS
       - Si ocurre un error al consultar la BD,
         responde con estado 500
    ========================================================= */
    if (err) {
      console.error("Error en BD:", err);
      return res.status(500).json({ error: "Error en BD" });
    }

    /* =========================================================
       USUARIO NO ENCONTRADO
       - Si no se encontró ningún registro, significa
         que el correo o la contraseña son incorrectos
       - Se responde con estado 401
    ========================================================= */
    if (!results || results.length === 0) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    /* =========================================================
       TOMAR EL PRIMER RESULTADO
       - Como la consulta usa LIMIT 1, se toma el primer registro
       - Ese objeto contiene los datos del usuario autenticado
    ========================================================= */
    const user = results[0];

    /* =========================================================
       VALIDACIÓN EXTRA DE SEGURIDAD
       - Se revisa que el usuario traiga todos los datos esperados
       - Si falta alguno, se responde con error 500
       - Esto ayuda a detectar inconsistencias en la BD
    ========================================================= */
    if (!user.idusuario || !user.nombre || !user.nombreRol || !user.estatus) {
      console.error("Datos incompletos del usuario:", user);
      return res.status(500).json({ error: "Error en datos del usuario" });
    }

    /* =========================================================
       VALIDAR ESTATUS DEL USUARIO
       - Se convierte el estatus a minúsculas para compararlo
         sin problemas
       - Solo se permite el acceso si el estatus es "activo"
       - Si está "inactivo" o "baja_temporal", se bloquea
         el acceso con error 403
    ========================================================= */
    const estatusUsuario = String(user.estatus).toLowerCase();

    if (estatusUsuario !== "activo") {
      let mensaje = "No tienes acceso al sistema";

      if (estatusUsuario === "inactivo") {
        mensaje = "Tu usuario está inactivo";
      } else if (estatusUsuario === "baja_temporal") {
        mensaje = "Tu usuario está en baja temporal";
      }

      return res.status(403).json({ error: mensaje });
    }

    /* =========================================================
       NORMALIZAR DATOS PARA EL FRONTEND
       - El nombre del usuario y el rol se pasan a minúsculas
       - Esto ayuda a hacer comparaciones más fáciles en frontend
    ========================================================= */
    const nombreUsuario = user.nombre.toLowerCase();
    const nombreRol = user.nombreRol.toLowerCase();

    /* =========================================================
       GENERAR TOKEN JWT
       - Se crea un token con los datos necesarios del usuario:
           * idusuario
           * nombre
           * rol
       - JWT_SECRET es la clave usada para firmarlo
       - expiresIn: "8h" indica que el token dura 8 horas
    ========================================================= */
    const token = jwt.sign(
      {
        idusuario: user.idusuario,
        nombre: user.nombre,
        rol: nombreRol,
      },
      JWT_SECRET,
      { expiresIn: "8h" },
    );

    /* =========================================================
       RESPUESTA FINAL
       - Si todo salió bien, devuelve:
           * token
           * usuario
           * rol
           * idusuario
           * estatus
       - Estos datos se usan en el frontend para guardar sesión
         y controlar permisos
    ========================================================= */
    res.json({
      token,
      usuario: nombreUsuario,
      rol: nombreRol,
      idusuario: user.idusuario,
      estatus: estatusUsuario,
    });
  });
});

/* =========================
   Perfiles
========================= */

// Responsables
/* =========================================================
   GET - OBTENER PERFIL DEL RESPONSABLE LOGUEADO
   - Esta ruta devuelve la información del perfil
     del responsable que ha iniciado sesión
   - Los datos del usuario se identifican usando
     el token validado por el middleware auth
   - Devuelve:
       * nombre
       * email
       * teléfono
       * ubicación
========================================================= */
app.get("/api/responsable/perfil", auth, (req, res) => {
  /* =========================================================
     OBTENER ID DEL USUARIO DESDE EL TOKEN
     - req.user fue agregado por el middleware auth
     - idusuario identifica al usuario que inició sesión
  ========================================================= */
  const idUsuario = req.user.idusuario;

  /* =========================================================
     CONSULTA SQL
     - Busca los datos del perfil del responsable
     - Toma la información general desde la tabla usuario
     - Une con la tabla responsable para obtener la ubicación
     - Filtra por idusuario para traer solo el perfil
       del usuario logueado
  ========================================================= */
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

  /* =========================================================
     EJECUTAR CONSULTA
     - Se envía el id del usuario autenticado como parámetro
     - Si hay error en la base de datos, responde con 500
     - Si todo sale bien, devuelve el primer resultado
       porque solo debe existir un perfil por usuario
  ========================================================= */
  connection.query(sql, [idUsuario], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtener perfil" });
    }

    /* =========================================================
       RESPUESTA FINAL
       - Se devuelve el primer registro encontrado
       - Se usa results[0] porque la consulta debe traer
         un solo perfil por cada usuario
    ========================================================= */
    res.json(results[0]);
  });
});

/* =========================================================
   PUT - ACTUALIZAR PERFIL DEL RESPONSABLE
   - Esta ruta permite actualizar los datos del responsable
     que ha iniciado sesión
   - Siempre actualiza el teléfono
   - La contraseña es opcional
   - Si se envía contraseña, se cifra con bcrypt antes
     de guardarse en la base de datos
========================================================= */
app.put("/api/responsable/perfil", auth, async (req, res) => {
  /* =========================================================
     OBTENER DATOS DEL USUARIO Y DEL BODY
     - idUsuario se toma desde el token validado
     - telefono y password llegan desde el frontend
  ========================================================= */
  const idUsuario = req.user.idusuario;
  const { telefono, password } = req.body;

  try {
    /* =========================================================
       CARGAR BCRYPT
       - bcrypt se usa para cifrar contraseñas
       - Esto evita guardar la contraseña en texto plano
    ========================================================= */
    const bcrypt = require("bcrypt");

    /* =========================================================
       ARMAR CONSULTA SQL BASE
       - Primero se construye el UPDATE para modificar
         el teléfono del usuario
       - values guarda los valores que se enviarán
         a la consulta
    ========================================================= */
    let sql = "UPDATE usuario SET telefono = ?";
    let values = [telefono];

    /* =========================================================
       VALIDAR SI SE ENVIÓ PASSWORD
       - Si password existe y no viene vacía,
         entonces también se actualizará
       - Antes de guardarla, se cifra usando bcrypt.hash
       - El valor 10 es el número de rondas de cifrado
    ========================================================= */
    if (password && password.trim() !== "") {
      const hash = await bcrypt.hash(password, 10);
      sql += ", password = ?";
      values.push(hash);
    }

    /* =========================================================
       COMPLETAR EL UPDATE
       - Se agrega la condición WHERE para actualizar
         solo al usuario autenticado
       - También se agrega idUsuario al arreglo de valores
    ========================================================= */
    sql += " WHERE idusuario = ?";
    values.push(idUsuario);

    /* =========================================================
       EJECUTAR CONSULTA
       - Ejecuta el UPDATE con los valores preparados
       - Si ocurre un error en la base de datos,
         responde con estado 500
    ========================================================= */
    connection.query(sql, values, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al actualizar usuario" });
      }

      /* =========================================================
         RESPUESTA FINAL
         - Si todo sale bien, responde con mensaje de éxito
      ========================================================= */
      res.json({ message: "Perfil actualizado correctamente" });
    });
  } catch (error) {
    /* =========================================================
       ERROR GENERAL
       - Captura errores fuera de la consulta, por ejemplo
         al cifrar la contraseña con bcrypt
       - Responde con estado 500
    ========================================================= */
    console.error(error);
    res.status(500).json({ error: "Error servidor" });
  }
});

// Alumnos
/* =========================================================
   GET - OBTENER PERFIL DEL ALUMNO LOGUEADO
   - Esta ruta devuelve la información del perfil
     del alumno que ha iniciado sesión
   - El usuario se identifica usando el token validado
     por el middleware auth
   - Devuelve:
       * nombre
       * email
       * teléfono
       * grupo
       * matrícula
       * idgrupo
       * foto de perfil
       * fechas de servicio
========================================================= */
app.get("/api/alumno/perfil", auth, (req, res) => {
  /* =========================================================
     OBTENER ID DEL USUARIO DESDE EL TOKEN
     - req.user fue agregado por el middleware auth
     - idusuario identifica al usuario que inició sesión
  ========================================================= */
  const idUsuario = req.user.idusuario;

  /* =========================================================
     CONSULTA SQL
     - Obtiene los datos del perfil del alumno
     - Toma la información general desde la tabla usuario
     - Une con la tabla alumno para traer matrícula,
       idgrupo y foto de perfil
     - Usa LEFT JOIN con grupo para traer el nombre del grupo
       y las fechas del servicio, incluso si el alumno
       no tiene grupo asignado
     - Filtra por idusuario para traer solo el perfil
       del usuario logueado
  ========================================================= */
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

  /* =========================================================
     EJECUTAR CONSULTA
     - Se envía el id del usuario autenticado como parámetro
     - Si hay error en la base de datos, responde con 500
     - Si todo sale bien, devuelve el primer resultado
       porque solo debe existir un perfil por usuario
  ========================================================= */
  connection.query(sql, [idUsuario], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtener perfil" });
    }

    /* =========================================================
       RESPUESTA FINAL
       - Se devuelve el primer registro encontrado
       - Se usa results[0] porque la consulta debe traer
         un solo perfil por cada usuario
    ========================================================= */
    res.json(results[0]);
  });
});

/* =========================================================
   PUT - ACTUALIZAR PERFIL DEL ALUMNO
   - Esta ruta permite actualizar los datos del alumno
     que ha iniciado sesión
   - Siempre actualiza el teléfono
   - La contraseña es opcional
   - Si se envía contraseña, se cifra con bcrypt antes
     de guardarse en la base de datos
========================================================= */
app.put("/api/alumno/perfil", auth, async (req, res) => {
  /* =========================================================
     OBTENER DATOS DEL USUARIO Y DEL BODY
     - idUsuario se toma desde el token validado
     - telefono y password llegan desde el frontend
  ========================================================= */
  const idUsuario = req.user.idusuario;
  const { telefono, password } = req.body;

  try {
    /* =========================================================
       CARGAR BCRYPT
       - bcrypt se usa para cifrar contraseñas
       - Esto evita guardar la contraseña en texto plano
    ========================================================= */
    const bcrypt = require("bcrypt");

    /* =========================================================
       ARMAR CONSULTA SQL BASE
       - Primero se construye el UPDATE para modificar
         el teléfono del usuario
       - values guarda los valores que se enviarán
         a la consulta
    ========================================================= */
    let sql = "UPDATE usuario SET telefono = ?";
    let values = [telefono];

    /* =========================================================
       VALIDAR SI SE ENVIÓ PASSWORD
       - Si password existe y no viene vacía,
         entonces también se actualizará
       - Antes de guardarla, se cifra usando bcrypt.hash
       - El valor 10 es el número de rondas de cifrado
    ========================================================= */
    if (password && password.trim() !== "") {
      const hash = await bcrypt.hash(password, 10);
      sql += ", password = ?";
      values.push(hash);
    }

    /* =========================================================
       COMPLETAR EL UPDATE
       - Se agrega la condición WHERE para actualizar
         solo al usuario autenticado
       - También se agrega idUsuario al arreglo de valores
    ========================================================= */
    sql += " WHERE idusuario = ?";
    values.push(idUsuario);

    /* =========================================================
       EJECUTAR CONSULTA
       - Ejecuta el UPDATE con los valores preparados
       - Si ocurre un error en la base de datos,
         responde con estado 500
    ========================================================= */
    connection.query(sql, values, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al actualizar usuario" });
      }

      /* =========================================================
         RESPUESTA FINAL
         - Si todo sale bien, responde con mensaje de éxito
      ========================================================= */
      res.json({ message: "Perfil de alumno actualizado" });
    });
  } catch (error) {
    /* =========================================================
       ERROR GENERAL
       - Captura errores fuera de la consulta, por ejemplo
         al cifrar la contraseña con bcrypt
       - Responde con estado 500
    ========================================================= */
    console.error(error);
    res.status(500).json({ error: "Error servidor" });
  }
});

/* =========================================================
   PUT - SUBIR O ACTUALIZAR FOTO DE PERFIL DEL ALUMNO
   - Esta ruta permite al alumno subir una nueva foto de perfil
     o reemplazar la que ya tenía
   - Usa el middleware auth para identificar al usuario
   - Usa multer para procesar y guardar la imagen enviada
   - Si el alumno ya tenía una foto anterior, intenta borrarla
     del servidor antes de guardar la nueva ruta en la BD
========================================================= */
app.put(
  "/api/alumno/perfil/foto",
  auth,
  uploadFotoAlumno.single("foto"),
  (req, res) => {
    /* =========================================================
       OBTENER ID DEL USUARIO DESDE EL TOKEN
       - req.user fue agregado por el middleware auth
       - idusuario identifica al alumno logueado
    ========================================================= */
    const idUsuario = req.user.idusuario;

    /* =========================================================
       VALIDAR QUE SE HAYA RECIBIDO UN ARCHIVO
       - req.file es agregado por multer cuando se sube
         correctamente un archivo
       - Si no existe, significa que no se recibió imagen
    ========================================================= */
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió ninguna imagen" });
    }

    /* =========================================================
       ARMAR LA NUEVA RUTA DE LA IMAGEN
       - req.file.filename contiene el nombre final del archivo
         generado por multer
       - Se guarda una ruta relativa para usarla después
         en el frontend o al consultar la BD
    ========================================================= */
    const rutaNueva = `/uploads/alumnos/${req.file.filename}`;

    /* =========================================================
       CONSULTA SQL
       - Busca la foto actual del alumno en la tabla alumno
       - Se usa para saber si ya tenía una imagen previa
       - LIMIT 1 asegura un solo resultado
    ========================================================= */
    const sqlBuscarFotoAnterior = `
      SELECT foto_perfil
      FROM alumno
      WHERE idusuario = ?
      LIMIT 1
    `;

    /* =========================================================
       BUSCAR FOTO ANTERIOR
       - Se consulta la BD para obtener la ruta actual
         de la foto del alumno
       - Si existe una foto anterior, se intentará borrarla
         del servidor
    ========================================================= */
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

        /* =========================================================
           OBTENER LA RUTA DE LA FOTO ANTERIOR
           - Si existe un registro con foto_perfil, se guarda
             en la variable fotoAnterior
           - Si no existe, se usa null
        ========================================================= */
        const fotoAnterior = results?.[0]?.foto_perfil || null;

        /* =========================================================
           BORRAR FOTO ANTERIOR SI EXISTE
           - Si el alumno ya tenía foto, se convierte la ruta
             relativa a una ruta física del servidor
           - replace(/^\//, "") quita la diagonal inicial
             para que path.join arme la ruta correctamente
           - fs.existsSync verifica que el archivo exista
             antes de intentar borrarlo
           - fs.unlinkSync elimina el archivo anterior
        ========================================================= */
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

        /* =========================================================
           CONSULTA SQL
           - Actualiza la columna foto_perfil del alumno
           - Guarda la nueva ruta de la imagen
           - Se actualiza por idusuario
        ========================================================= */
        const sqlActualizarFoto = `
        UPDATE alumno
        SET foto_perfil = ?
        WHERE idusuario = ?
      `;

        /* =========================================================
           ACTUALIZAR FOTO EN BASE DE DATOS
           - Guarda la nueva ruta de la foto en la tabla alumno
           - Si ocurre error, responde con 500
           - Si no afecta filas, significa que el alumno no existe
        ========================================================= */
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

            /* =========================================================
               RESPUESTA FINAL
               - Indica que la foto fue actualizada correctamente
               - También devuelve la nueva ruta guardada
            ========================================================= */
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

// TUTORES
/* =========================================================
   GET - OBTENER PERFIL DEL TUTOR LOGUEADO
   - Esta ruta devuelve la información del perfil
     del tutor que ha iniciado sesión
   - El usuario se identifica usando el token validado
     por el middleware auth
   - Devuelve:
       * nombre
       * email
       * teléfono
       * grupo asignado
       * id del grupo
       * id del tutor
========================================================= */
app.get("/api/tutor/perfil", auth, (req, res) => {
  /* =========================================================
     OBTENER ID DEL USUARIO DESDE EL TOKEN
     - req.user fue agregado por el middleware auth
     - idusuario identifica al usuario que inició sesión
  ========================================================= */
  const idUsuario = req.user.idusuario;

  /* =========================================================
     CONSULTA SQL
     - Obtiene los datos del perfil del tutor
     - Toma la información general desde la tabla usuario
     - Une con la tabla tutor para obtener el idtutor
     - Usa LEFT JOIN con grupo para traer el grupo asignado,
       en caso de que exista
     - Filtra por idusuario para traer solo el perfil
       del usuario logueado
  ========================================================= */
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

  /* =========================================================
     EJECUTAR CONSULTA
     - Se envía el id del usuario autenticado como parámetro
     - Si hay error en la base de datos, responde con 500
     - Si todo sale bien, devuelve el primer resultado
  ========================================================= */
  connection.query(sql, [idUsuario], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtener perfil" });
    }

    /* =========================================================
       RESPUESTA FINAL
       - Se devuelve el primer registro encontrado
       - Se usa results[0] porque la consulta busca
         el perfil del tutor logueado
    ========================================================= */
    res.json(results[0]);
  });
});

/* =========================================================
   PUT - ACTUALIZAR PERFIL DEL TUTOR
   - Esta ruta permite actualizar los datos del tutor
     que ha iniciado sesión
   - Siempre actualiza el teléfono
   - La contraseña es opcional
   - Si se envía contraseña, se cifra con bcrypt antes
     de guardarse en la base de datos
========================================================= */
app.put("/api/tutor/perfil", auth, async (req, res) => {
  /* =========================================================
     OBTENER DATOS DEL USUARIO Y DEL BODY
     - idUsuario se toma desde el token validado
     - telefono y password llegan desde el frontend
  ========================================================= */
  const idUsuario = req.user.idusuario;
  const { telefono, password } = req.body;

  try {
    /* =========================================================
       CARGAR BCRYPT
       - bcrypt se usa para cifrar contraseñas
       - Esto evita guardar la contraseña en texto plano
    ========================================================= */
    const bcrypt = require("bcrypt");

    /* =========================================================
       ARMAR CONSULTA SQL BASE
       - Primero se construye el UPDATE para modificar
         el teléfono del usuario
       - values guarda los valores que se enviarán
         a la consulta
    ========================================================= */
    let sql = "UPDATE usuario SET telefono = ?";
    let values = [telefono];

    /* =========================================================
       VALIDAR SI SE ENVIÓ PASSWORD
       - Si password existe y no viene vacía,
         entonces también se actualizará
       - Antes de guardarla, se cifra usando bcrypt.hash
       - El valor 10 es el número de rondas de cifrado
    ========================================================= */
    if (password && password.trim() !== "") {
      const hash = await bcrypt.hash(password, 10);
      sql += ", password = ?";
      values.push(hash);
    }

    /* =========================================================
       COMPLETAR EL UPDATE
       - Se agrega la condición WHERE para actualizar
         solo al usuario autenticado
       - También se agrega idUsuario al arreglo de valores
    ========================================================= */
    sql += " WHERE idusuario = ?";
    values.push(idUsuario);

    /* =========================================================
       EJECUTAR CONSULTA
       - Ejecuta el UPDATE con los valores preparados
       - Si ocurre un error en la base de datos,
         responde con estado 500
    ========================================================= */
    connection.query(sql, values, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al actualizar usuario" });
      }

      /* =========================================================
         RESPUESTA FINAL
         - Si todo sale bien, responde con mensaje de éxito
      ========================================================= */
      res.json({ message: "Perfil de tutor actualizado" });
    });
  } catch (error) {
    /* =========================================================
       ERROR GENERAL
       - Captura errores fuera de la consulta, por ejemplo
         al cifrar la contraseña con bcrypt
       - Responde con estado 500
    ========================================================= */
    console.error(error);
    res.status(500).json({ error: "Error servidor" });
  }
});

/* =========================
   API EXTERNA - FERIADOS
   Usa Nager.Date para consultar días festivos de México
========================= */

/* =========================================================
   FUNCIÓN: OBTENER FERIADOS DE MÉXICO DESDE UNA API EXTERNA
   - Esta función consulta una API pública para obtener
     los días feriados oficiales de México de un año específico
   - Recibe como parámetro el año que se quiere consultar
   - Hace una petición HTTP GET usando fetch
   - Si la respuesta es válida, regresa un arreglo con los feriados
   - Si ocurre un error en la respuesta, lanza una excepción
========================================================= */
async function obtenerFeriadosMX(anio) {
  /* =========================================================
     CONSTRUIR LA URL DE LA API
     - Se arma dinámicamente la dirección que se va a consultar
     - ${anio} inserta el año recibido como parámetro
     - /MX indica que la consulta será para México

     EJEMPLOS DE URL GENERADA:
     - Si anio = 2026:
       https://date.nager.at/api/v3/PublicHolidays/2026/MX
     - Si anio = 2025:
       https://date.nager.at/api/v3/PublicHolidays/2025/MX

     PARTES DE LA URL:
     - https://date.nager.at
       Es el dominio de la API pública
     - /api/v3
       Es la versión de la API
     - /PublicHolidays
       Es el recurso o endpoint que devuelve días festivos
     - /${anio}
       Es el año que se quiere consultar
     - /MX
       Es el código del país, en este caso México
  ========================================================= */
  const url = `https://date.nager.at/api/v3/PublicHolidays/${anio}/MX`;

  /* =========================================================
     HACER LA PETICIÓN HTTP
     - fetch(url) realiza una solicitud GET a la API
     - Como la función es async, se usa await para esperar
       a que el servidor responda
     - La variable respuesta guarda el objeto Response
       que devuelve fetch
  ========================================================= */
  const respuesta = await fetch(url);

  /* =========================================================
     VALIDAR SI LA RESPUESTA FUE EXITOSA
     - respuesta.ok es true cuando la respuesta HTTP
       está en un rango exitoso, por ejemplo 200-299
     - Si es false, significa que hubo un problema,
       por ejemplo:
         * URL incorrecta
         * año inválido
         * servidor no disponible
         * error de red o del servicio
     - En ese caso se lanza un error con throw
  ========================================================= */
  if (!respuesta.ok) {
    throw new Error(`No se pudieron obtener feriados del año ${anio}`);
  }

  /* =========================================================
     CONVERTIR LA RESPUESTA A JSON
     - respuesta.json() transforma el cuerpo de la respuesta
       en un objeto o arreglo de JavaScript
     - Se usa await porque esa conversión también es asíncrona
     - En esta API normalmente se recibe un arreglo de objetos
       con información de cada feriado
  ========================================================= */
  const data = await respuesta.json();

  /* =========================================================
     RETORNAR EL RESULTADO
     - Se valida que data realmente sea un arreglo
     - Si sí es un arreglo, se regresa tal cual
     - Si por alguna razón no lo es, se regresa un arreglo vacío
       para evitar errores en el resto del programa
  ========================================================= */
  return Array.isArray(data) ? data : [];
}

/* =========================================================
   FUNCIÓN: OBTENER UN MAPA DE FERIADOS DE VARIOS AÑOS
   - Esta función recibe una lista de años
   - Por cada año consulta los feriados oficiales de México
     usando la función obtenerFeriadosMX(anio)
   - Después guarda esos feriados en un objeto Map
   - La clave del Map será la fecha del feriado
   - El valor del Map será el nombre del feriado
   - Al final regresa el Map completo con todos los feriados
     de los años solicitados
========================================================= */
async function obtenerMapaFeriadosDeAnios(anios) {
  /* =========================================================
     CREAR EL MAPA VACÍO
     - new Map() crea una estructura tipo clave-valor
     - Aquí se usará así:
         clave  -> fecha del feriado
         valor  -> nombre del feriado
     - Ejemplo:
         "2026-01-01" => "Año Nuevo"
         "2026-11-16" => "Revolución Mexicana"
     - Se usa Map porque permite buscar por fecha
       de forma rápida
  ========================================================= */
  const mapa = new Map();

  /* =========================================================
     RECORRER LA LISTA DE AÑOS
     - anios debe ser un arreglo, por ejemplo:
         [2025, 2026]
     - for...of recorre cada año uno por uno
     - Por cada año se llama a obtenerFeriadosMX(anio)
     - await espera a que termine la consulta antes
       de seguir con el siguiente año
  ========================================================= */
  for (const anio of anios) {
    /* =========================================================
       OBTENER LOS FERIADOS DE ESE AÑO
       - obtenerFeriadosMX(anio) hace la petición
         a la API externa
       - Devuelve un arreglo de objetos con los feriados
       - Ejemplo de un posible objeto:
           {
             date: "2026-01-01",
             localName: "Año Nuevo",
             name: "New Year's Day"
           }
    ========================================================= */
    const feriados = await obtenerFeriadosMX(anio);

    /* =========================================================
       RECORRER CADA FERIADO DEL AÑO
       - forEach recorre el arreglo de feriados
       - Cada elemento f representa un feriado
    ========================================================= */
    feriados.forEach((f) => {
      /* =========================================================
         VALIDAR QUE EL FERIADO TENGA FECHA
         - f?.date verifica de forma segura que exista
           la propiedad date
         - Si existe, se guarda en el Map
         - Si no existe, ese registro se ignora
      ========================================================= */
      if (f?.date) {
        /* =========================================================
           GUARDAR EN EL MAPA
           - mapa.set(clave, valor) agrega un registro al Map
           - La clave será la fecha del feriado, por ejemplo:
               "2026-01-01"
           - El valor será el nombre del feriado
           - Se intenta usar primero:
               1) f.localName  -> nombre local en español
               2) f.name       -> nombre general
               3) "Día festivo" -> texto por defecto si no viene nombre

           EJEMPLO:
           mapa.set("2026-01-01", "Año Nuevo");
        ========================================================= */
        mapa.set(f.date, f.localName || f.name || "Día festivo");
      }
    });
  }

  /* =========================================================
     RETORNAR EL MAPA FINAL
     - Devuelve el Map con todos los feriados encontrados
       de todos los años consultados
     - Ejemplo de contenido final:
         {
           "2025-01-01" => "Año Nuevo",
           "2025-02-03" => "Día de la Constitución",
           "2026-01-01" => "Año Nuevo"
         }
  ========================================================= */
  return mapa;
}

/* =========================================================
   FUNCIÓN: OBTENER AÑOS A PARTIR DE UNA O VARIAS FECHAS
   - Esta función recibe una cantidad variable de fechas
   - Extrae únicamente el año de cada fecha recibida
   - Elimina valores vacíos o inválidos
   - También elimina años repetidos
   - Al final devuelve un arreglo con los años únicos
========================================================= */
function obtenerAniosDeFechas(...fechas) {
  /* =========================================================
     ...fechas
     - El operador ... en los parámetros significa
       "rest parameters"
     - Permite recibir varias fechas en una sola función
     - Todas las fechas se agrupan en un arreglo llamado fechas

     EJEMPLO:
     obtenerAniosDeFechas("2025-01-10", "2026-03-15", "2025-12-20")

     Dentro de la función, fechas sería:
     ["2025-01-10", "2026-03-15", "2025-12-20"]
  ========================================================= */

  return [
    /* =========================================================
       new Set(...)
       - Set es una estructura que no permite duplicados
       - Se usa aquí para que si varias fechas pertenecen
         al mismo año, ese año aparezca solo una vez

       EJEMPLO:
       ["2025", "2026", "2025"] -> Set -> {"2025", "2026"}
    ========================================================= */
    ...new Set(
      /* =========================================================
         fechas.filter(Boolean)
         - filter(Boolean) elimina valores vacíos o falsos
         - Sirve para ignorar valores como:
             null
             undefined
             ""
             false
             0
         - Así se procesan solo fechas que realmente existan

         EJEMPLO:
         ["2025-01-10", null, "", "2026-03-15"]
         después de filter(Boolean):
         ["2025-01-10", "2026-03-15"]
      ========================================================= */
      fechas
        .filter(Boolean)

        /* =========================================================
           .map((fecha) => String(fecha).split("-")[0])
           - map transforma cada fecha del arreglo
           - String(fecha) convierte la fecha a texto
             por seguridad
           - split("-") divide la fecha usando el guion
           - [0] toma la primera parte, que corresponde al año

           EJEMPLO:
           "2026-03-15".split("-") -> ["2026", "03", "15"]
           [0] -> "2026"

           Entonces:
           ["2025-01-10", "2026-03-15"]
           se transforma en:
           ["2025", "2026"]
        ========================================================= */
        .map((fecha) => String(fecha).split("-")[0]),
    ),
  ];

  /* =========================================================
     RESULTADO FINAL
     - El operador ... delante de new Set(...) convierte
       el Set otra vez en arreglo
     - Así la función devuelve un array normal

     EJEMPLO DE SALIDA:
     ["2025", "2026"]
  ========================================================= */
}

/* =========================================================
   FUNCIÓN: VALIDAR QUE UNA O VARIAS FECHAS NO SEAN FERIADAS
   - Esta función recibe una o varias fechas
   - Obtiene los años involucrados en esas fechas
   - Consulta los feriados oficiales de México para esos años
   - Revisa si alguna de las fechas recibidas coincide
     con un día festivo
   - Si encuentra una coincidencia, devuelve que no es válida
     junto con la fecha y el nombre del feriado
   - Si ninguna fecha es feriada, devuelve que sí es válida
========================================================= */
async function validarFechasNoFeriadas(...fechas) {
  /* =========================================================
     OBTENER LOS AÑOS DE LAS FECHAS RECIBIDAS
     - Se usa la función obtenerAniosDeFechas(...fechas)
     - Esta función toma todas las fechas enviadas y extrae
       únicamente los años, sin repetirlos

     EJEMPLO:
     fechas = ["2026-01-01", "2026-02-05", "2025-12-25"]

     anios sería:
     ["2026", "2025"]
  ========================================================= */
  const anios = obtenerAniosDeFechas(...fechas);

  /* =========================================================
     OBTENER EL MAPA DE FERIADOS DE ESOS AÑOS
     - Se usa la función obtenerMapaFeriadosDeAnios(anios)
     - Esa función consulta la API externa y devuelve un Map
       con la estructura:
         clave  -> fecha del feriado
         valor  -> nombre del feriado

     EJEMPLO:
     mapaFeriados podría contener:
     "2026-01-01" => "Año Nuevo"
     "2025-12-25" => "Navidad"
  ========================================================= */
  const mapaFeriados = await obtenerMapaFeriadosDeAnios(anios);

  /* =========================================================
     RECORRER LAS FECHAS RECIBIDAS
     - Se revisa una por una
     - Si la fecha existe y además está dentro del Map,
       significa que sí cae en un día feriado
  ========================================================= */
  for (const fecha of fechas) {
    /* =========================================================
       VALIDAR SI LA FECHA ES FERIADO
       - fecha comprueba que sí exista un valor
       - mapaFeriados.has(fecha) revisa si esa fecha está
         registrada como feriado en el Map

       EJEMPLO:
       mapaFeriados.has("2026-01-01") -> true
    ========================================================= */
    if (fecha && mapaFeriados.has(fecha)) {
      /* =========================================================
         RETORNAR RESULTADO INVÁLIDO
         - esValida: false indica que la validación falló
         - fecha devuelve la fecha problemática
         - nombreFeriado devuelve el nombre del festivo
           encontrado en el Map usando get(fecha)

         EJEMPLO DE RESPUESTA:
         {
           esValida: false,
           fecha: "2026-01-01",
           nombreFeriado: "Año Nuevo"
         }
      ========================================================= */
      return {
        esValida: false,
        fecha,
        nombreFeriado: mapaFeriados.get(fecha),
      };
    }
  }

  /* =========================================================
     RETORNAR RESULTADO VÁLIDO
     - Si terminó el recorrido y no encontró ninguna fecha
       feriada, entonces todas son válidas
     - Se devuelve un objeto simple indicando éxito

     EJEMPLO:
     { esValida: true }
  ========================================================= */
  return { esValida: true };
}

/* =========================
   CRUD ACTIVIDADES 
========================= */

/* =========================================================
   GET - OBTENER ACTIVIDADES
   - Responsable: ve únicamente SUS actividades, incluso pendientes
   - Director/Tutor: ven todas excepto las pendientes
   - Alumno: solo ve actividades activas dentro de su periodo
   - También se calcula:
       * inscritos -> cuántos alumnos están asignados
       * inscrito -> si el alumno logueado ya está inscrito
       * horas_cumplidas -> suma de horas cumplidas en tareas
       * porcentaje_avance -> progreso de la actividad
========================================================= */
app.get("/api/actividad", auth, (req, res) => {
  /* =========================================================
     OBTENER DATOS DEL USUARIO LOGUEADO
     - rol se usa para decidir qué actividades puede ver
     - idusuario se usa en filtros y subconsultas
  ========================================================= */
  const rolLogueado = req.user.rol.toLowerCase();
  const idUsuarioLogueado = req.user.idusuario;

  /* =========================================================
     FUNCIÓN PRINCIPAL PARA EJECUTAR LA CONSULTA
     - Si el usuario es responsable, recibe idResponsable
     - Para otros roles no es necesario
  ========================================================= */
  function ejecutarQueryPrincipal(idResponsable = null) {
    /* =========================================================
       CONSULTA SQL PRINCIPAL
       - Obtiene todas las columnas de actividad
       - Trae el nombre del responsable
       - Calcula:
           * inscritos
           * inscrito
           * horas_cumplidas
       - La consulta se arma de forma dinámica según el rol
    ========================================================= */
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

    /* =========================================================
       PARÁMETROS DE LA CONSULTA
       - El primer parámetro siempre es idUsuarioLogueado
         para la subconsulta de "inscrito"
    ========================================================= */
    let params = [idUsuarioLogueado];

    /* =========================================================
       FILTROS SEGÚN EL ROL
       - Responsable: solo sus actividades
       - Director/Tutor: todas menos pendientes
       - Alumno: solo activas y dentro del periodo del grupo
    ========================================================= */
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

    /* =========================================================
       ORDEN DE RESULTADOS
       - Primero las activas
       - Después finalizadas
       - Después canceladas
       - Luego cualquier otro estatus
       - Dentro de cada grupo se ordena por fecha_alta descendente
    ========================================================= */
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

    /* =========================================================
       EJECUTAR CONSULTA DE ACTIVIDADES
    ========================================================= */
    connection.query(sql, params, (err, result) => {
      if (err) {
        console.error("❌ Error al obtener actividades:", err);
        return res.status(500).json({ msg: "Error al obtener actividades" });
      }

      /* =========================================================
         PROCESAR RESULTADOS
         - Convierte horas a número
         - Calcula porcentaje_avance
         - Reglas:
             * Pendiente -> 0%
             * Finalizada -> 100%
             * Activa u otras -> según horas cumplidas / horas actividad
      ========================================================= */
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

      /* =========================================================
         RESPUESTA FINAL
      ========================================================= */
      res.json(actividadesProcesadas);
    });
  }

  /* =========================================================
     CASO RESPONSABLE
     - Primero se busca el idresponsable usando idusuario
     - Luego se ejecuta la consulta principal filtrada
  ========================================================= */
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

  /* =========================================================
     CASO ALUMNO
     - Primero se valida que el alumno tenga grupo
     - También se revisa que su grupo tenga periodo definido
     - Si no tiene periodo, se responde con data vacía
  ========================================================= */
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

  /* =========================================================
     CASO DIRECTOR O TUTOR
     - No ocupan validación extra
     - Ejecutan la consulta principal directamente
  ========================================================= */
    ejecutarQueryPrincipal();
  }
});

/* =========================================================
   POST - CREAR ACTIVIDAD
   - Solo el responsable puede crear actividades
   - Valida datos obligatorios
   - Valida que la fecha de término no sea menor a la inicial
   - Valida que las fechas no caigan en días festivos
   - Busca el idresponsable del usuario logueado
   - Guarda la actividad con estatus inicial 'Pendiente'
========================================================= */
app.post(
  "/api/actividad",
  auth,
  requireRole("responsable"),
  async (req, res) => {
    /* =========================================================
       OBTENER DATOS DEL BODY
    ========================================================= */
    const {
      nombreActividad,
      descripcion,
      horas_actividad,
      fecha_alta,
      fechaTermino,
      totalAlumnosRequeridos,
    } = req.body;

    const idUsuario = req.user.idusuario;

    /* =========================================================
       VALIDAR DATOS OBLIGATORIOS
    ========================================================= */
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

    /* =========================================================
       VALIDAR ORDEN DE FECHAS
    ========================================================= */
    if (fechaTermino < fecha_alta) {
      return res.status(400).json({
        msg: "La fecha de término no puede ser menor que la fecha de inicio",
      });
    }

    try {
      /* =========================================================
         VALIDAR DÍAS FESTIVOS
         - Se revisa que fecha_alta y fechaTermino
           no coincidan con feriados oficiales
      ========================================================= */
      const validacionFeriados = await validarFechasNoFeriadas(
        fecha_alta,
        fechaTermino,
      );

      if (!validacionFeriados.esValida) {
        return res.status(400).json({
          msg: `No se puede guardar el proyecto: la fecha ${validacionFeriados.fecha} es día festivo (${validacionFeriados.nombreFeriado}).`,
        });
      }

      /* =========================================================
         CONSULTA SQL
         - Obtiene el idresponsable a partir del idusuario
           del responsable logueado
      ========================================================= */
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

        /* =========================================================
           CONSULTA SQL
           - Inserta una nueva actividad
           - El estatus inicial siempre es 'Pendiente'
        ========================================================= */
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

            /* =========================================================
               RESPUESTA FINAL
            ========================================================= */
            res.json({ success: true, msg: "Actividad creada correctamente" });
          },
        );
      });
    } catch (error) {
      /* =========================================================
         ERROR GENERAL EN VALIDACIÓN DE FERIADOS
      ========================================================= */
      console.error("Error al validar feriados en actividad:", error);
      return res.status(500).json({
        msg: "Error al validar días festivos para la actividad",
      });
    }
  },
);

/* =========================================================
   PUT - EDITAR ACTIVIDAD
   - Solo el responsable puede editar
   - Valida datos obligatorios
   - Valida el orden de fechas
   - Valida días festivos
   - Solo permite editar actividades que pertenezcan
     al responsable logueado
========================================================= */
app.put(
  "/api/actividad/:id",
  auth,
  requireRole("responsable"),
  async (req, res) => {
    /* =========================================================
       OBTENER ID DE LA ACTIVIDAD Y DATOS DEL BODY
    ========================================================= */
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

    /* =========================================================
       VALIDAR DATOS OBLIGATORIOS
    ========================================================= */
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

    /* =========================================================
       VALIDAR ORDEN DE FECHAS
    ========================================================= */
    if (fechaTermino < fecha_alta) {
      return res.status(400).json({
        msg: "La fecha de término no puede ser menor que la fecha de inicio",
      });
    }

    try {
      /* =========================================================
         VALIDAR DÍAS FESTIVOS
      ========================================================= */
      const validacionFeriados = await validarFechasNoFeriadas(
        fecha_alta,
        fechaTermino,
      );

      if (!validacionFeriados.esValida) {
        return res.status(400).json({
          msg: `No se puede actualizar el proyecto: la fecha ${validacionFeriados.fecha} es día festivo (${validacionFeriados.nombreFeriado}).`,
        });
      }

      /* =========================================================
         CONSULTA SQL
         - Obtiene el idresponsable del usuario logueado
      ========================================================= */
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

        /* =========================================================
           CONSULTA SQL
           - Actualiza la actividad
           - Solo se actualiza si:
               * el idactividad coincide
               * y pertenece al responsable logueado
        ========================================================= */
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

            /* =========================================================
               SI NO AFECTA FILAS
               - Significa que la actividad no existe
                 o no pertenece a ese responsable
            ========================================================= */
            if (result.affectedRows === 0) {
              return res.status(403).json({
                msg: "No tienes permiso para editar esta actividad",
              });
            }

            /* =========================================================
               RESPUESTA FINAL
            ========================================================= */
            res.json({ success: true });
          },
        );
      });
    } catch (error) {
      /* =========================================================
         ERROR GENERAL EN VALIDACIÓN DE FERIADOS
      ========================================================= */
      console.error("Error al validar feriados al editar actividad:", error);
      return res.status(500).json({
        msg: "Error al validar días festivos para la actividad",
      });
    }
  },
);

/* =========================================================
   DELETE - CANCELAR ACTIVIDAD
   - Solo el responsable puede cancelar
   - No elimina físicamente el registro
   - Solo cambia el estatus a 'Cancelada'
   - Funciona como una baja lógica
========================================================= */
app.delete(
  "/api/actividad/:id",
  auth,
  requireRole("responsable"),
  (req, res) => {
    /* =========================================================
       OBTENER ID DE LA ACTIVIDAD
    ========================================================= */
    const { id } = req.params;

    /* =========================================================
       CONSULTA SQL
       - En vez de borrar el registro, actualiza el estatus
         de la actividad a 'Cancelada'
    ========================================================= */
    const sql =
      "UPDATE actividad SET estatus = 'Cancelada' WHERE idactividad = ?";

    /* =========================================================
       EJECUTAR CANCELACIÓN
    ========================================================= */
    connection.query(sql, [id], (err) => {
      if (err) return res.status(500).json({ error: "Error al cancelar" });

      /* =========================================================
         RESPUESTA FINAL
      ========================================================= */
      res.json({ success: true, msg: "Actividad cancelada" });
    });
  },
);

/* =========================
   CRUD Tareas_Actividad
========================= */

/* =========================================================
   GET - OBTENER TAREAS DE UNA ACTIVIDAD
   - Devuelve las tareas de una actividad específica
   - Si el usuario NO es alumno:
       * solo lista las tareas normales
   - Si el usuario SÍ es alumno:
       * además trae el estatus de cumplimiento
         de cada tarea para ese alumno
========================================================= */
app.get("/api/tareas/:idactividad", auth, (req, res) => {
  /* =========================================================
     OBTENER DATOS DE LA PETICIÓN Y DEL USUARIO LOGUEADO
     - idactividad viene en la URL
     - idUsuario y rol vienen del token validado por auth
  ========================================================= */
  const { idactividad } = req.params;
  const idUsuario = req.user?.idusuario;
  const rol = req.user?.rol?.toLowerCase();

  /* =========================================================
     VALIDAR QUE EXISTA USUARIO AUTENTICADO
     - Si por alguna razón no viene rol en req.user,
       se considera que no hay autenticación válida
  ========================================================= */
  if (!rol) {
    return res.status(401).json({ error: "Usuario no autenticado" });
  }

  /* =========================================================
     CASO 1: USUARIO DISTINTO DE ALUMNO
     - Responsable, tutor o director solo necesitan ver
       el listado de tareas de la actividad
     - No se necesita consultar cumplimientotarea
  ========================================================= */
  if (rol !== "alumno") {
    /* =========================================================
       CONSULTA SQL
       - Obtiene las tareas de la actividad indicada
       - Devuelve:
           * id de la tarea
           * nombre
           * horas
           * fechaInicio
           * fechaFin
       - Se ordena por fecha de inicio y fin
    ========================================================= */
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

    /* =========================================================
       EJECUTAR CONSULTA
    ========================================================= */
    connection.query(sql, [idactividad], (err, results) => {
      if (err) {
        console.error("ERROR TAREAS:", err);
        return res.status(500).json({ error: "Error al obtener tareas" });
      }

      return res.json(results);
    });

    return;
  }

  /* =========================================================
     CASO 2: USUARIO ALUMNO
     - Primero se obtiene la matrícula del alumno logueado
     - Después se consultan las tareas de la actividad
       junto con su estatus de cumplimiento
  ========================================================= */

  /* =========================================================
     CONSULTA SQL
     - Busca la matrícula del alumno usando su idusuario
  ========================================================= */
  const sqlAlumno = `SELECT matricula FROM alumno WHERE idusuario = ?`;

  connection.query(sqlAlumno, [idUsuario], (errA, resultA) => {
    if (errA) {
      console.error(errA);
      return res.status(500).json({ error: "Error al obtener alumno" });
    }

    if (!resultA || resultA.length === 0) {
      return res.status(404).json({ error: "Alumno no encontrado" });
    }

    /* =========================================================
       OBTENER MATRÍCULA DEL ALUMNO
    ========================================================= */
    const matricula = resultA[0].matricula;

    /* =========================================================
       CONSULTA SQL
       - Obtiene las tareas de la actividad
       - También intenta traer el estatus de cumplimiento
         de cada tarea para ESTE alumno
       - Para eso:
           * une tareas_actividad con asignacion_actividad
           * filtra la asignación por matrícula
           * une con cumplimientotarea usando la asignación
             y el id de la tarea
       - Así cada tarea puede traer algo como:
           * Pendiente
           * Cumplida
           * null si todavía no existe relación
    ========================================================= */
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

    /* =========================================================
       EJECUTAR CONSULTA
    ========================================================= */
    connection.query(sql, [matricula, idactividad], (err, results) => {
      if (err) {
        console.error("ERROR TAREAS:", err);
        return res.status(500).json({ error: "Error al obtener tareas" });
      }

      return res.json(results);
    });
  });
});

/* =========================================================
   ACTIVAR ACTIVIDAD AUTOMÁTICAMENTE
   - Si una actividad está en Pendiente
   - y ya existe al menos una tarea creada
   - entonces se cambia a Activa
   - Esta función NO finaliza la actividad;
     solo la activa si sigue pendiente
========================================================= */
function activarActividadSiEstaPendiente(idactividad, callback) {
  /* =========================================================
     CONSULTA SQL
     - Actualiza el estatus a 'Activa'
     - Solo si:
         * coincide el idactividad
         * actualmente está en 'Pendiente'
  ========================================================= */
  const sqlActivar = `
    UPDATE actividad
    SET estatus = 'Activa'
    WHERE idactividad = ?
      AND estatus = 'Pendiente'
  `;

  /* =========================================================
     EJECUTAR UPDATE
    ========================================================= */
  connection.query(sqlActivar, [idactividad], (err) => {
    if (err) {
      console.error("Error al activar actividad automáticamente:", err);
      return callback(err);
    }

    callback(null);
  });
}

/* =========================================================
   POST - CREAR TAREA
   - Solo el responsable puede crear tareas
   - Valida:
       * datos obligatorios
       * orden de fechas
       * que no caigan en feriados
       * que las horas no excedan el total de la actividad
       * que la tarea esté dentro del rango del proyecto
   - Después:
       * inserta la tarea
       * la asigna a todos los alumnos inscritos
       * intenta activar la actividad si estaba pendiente
========================================================= */
app.post("/api/tareas", auth, requireRole("responsable"), async (req, res) => {
  /* =========================================================
     OBTENER DATOS DEL BODY
     - Convierte idactividad y horas_Tareas a número
  ========================================================= */
  let { idactividad, nombre_tarea, horas_Tareas, fechaInicio, fechaFin } =
    req.body;

  idactividad = Number(idactividad);
  horas_Tareas = Number(horas_Tareas);

  /* =========================================================
     VALIDAR DATOS OBLIGATORIOS
  ========================================================= */
  if (
    !idactividad ||
    !nombre_tarea ||
    !horas_Tareas ||
    !fechaInicio ||
    !fechaFin
  ) {
    return res.status(400).json({ msg: "Datos incompletos" });
  }

  /* =========================================================
     VALIDAR ORDEN DE FECHAS
  ========================================================= */
  if (fechaFin < fechaInicio) {
    return res.status(400).json({
      msg: "La fecha de fin no puede ser menor que la fecha de inicio",
    });
  }

  try {
    /* =========================================================
       VALIDAR DÍAS FESTIVOS
       - Revisa que fechaInicio y fechaFin
         no caigan en feriados oficiales
    ========================================================= */
    const validacionFeriados = await validarFechasNoFeriadas(
      fechaInicio,
      fechaFin,
    );

    if (!validacionFeriados.esValida) {
      return res.status(400).json({
        msg: `No se puede crear la tarea: la fecha ${validacionFeriados.fecha} es día festivo (${validacionFeriados.nombreFeriado}).`,
      });
    }

    /* =========================================================
       CONSULTA SQL
       - Suma las horas actuales de todas las tareas
         ya registradas en la actividad
       - Sirve para no exceder horas_actividad
    ========================================================= */
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

      /* =========================================================
         CONSULTA SQL
         - Obtiene información de la actividad:
             * horas_actividad
             * fecha_alta
             * fechaTermino
         - Sirve para validar:
             * límite total de horas
             * rango de fechas del proyecto
      ========================================================= */
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

        /* =========================================================
           EXTRAER DATOS DE LA ACTIVIDAD
           - Convierte horas a número
           - Convierte fechas de la BD a formato YYYY-MM-DD
        ========================================================= */
        const horasActividad = Number(result2[0].horas_actividad) || 0;

        const fechaProyectoInicio = result2[0].fecha_alta
          ? result2[0].fecha_alta.toISOString().split("T")[0]
          : null;

        const fechaProyectoFin = result2[0].fechaTermino
          ? result2[0].fechaTermino.toISOString().split("T")[0]
          : null;

        /* =========================================================
           VALIDAR QUE LA TAREA ESTÉ DENTRO DEL RANGO
           DEL PROYECTO
        ========================================================= */
        if (fechaInicio < fechaProyectoInicio || fechaFin > fechaProyectoFin) {
          return res.status(400).json({
            msg: `La tarea debe estar dentro del rango del proyecto: ${fechaProyectoInicio} a ${fechaProyectoFin}`,
          });
        }

        /* =========================================================
           VALIDAR QUE LAS HORAS NO EXCEDAN EL TOTAL
        ========================================================= */
        if (totalActual + horas_Tareas > horasActividad) {
          return res.status(400).json({
            msg: "Las horas exceden el total de la actividad",
          });
        }

        /* =========================================================
           CONSULTA SQL
           - Inserta la nueva tarea en tareas_actividad
        ========================================================= */
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

            /* =========================================================
               OBTENER ID DE LA TAREA NUEVA
            ========================================================= */
            const idTareaNueva = resultInsert.insertId;

            /* =========================================================
               CONSULTA SQL
               - Inserta en cumplimientotarea una fila por cada
                 alumno que ya está asignado a la actividad
               - Todas empiezan en estatus 'Pendiente'
               - Esto permite que la nueva tarea aparezca
                 automáticamente para todos los alumnos inscritos
            ========================================================= */
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

                /* =========================================================
                   ACTIVAR ACTIVIDAD SI ESTABA PENDIENTE
                ========================================================= */
                activarActividadSiEstaPendiente(idactividad, (err5) => {
                  if (err5) {
                    return res.status(500).json({
                      msg: "Tarea creada, pero ocurrió un error al activar la actividad",
                    });
                  }

                  /* =========================================================
                     RESPUESTA FINAL
                  ========================================================= */
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

/* =========================================================
   PUT - EDITAR TAREA
   - Solo el responsable puede editar tareas
   - Valida:
       * datos obligatorios
       * orden de fechas
       * feriados
       * límite de horas de la actividad
       * rango permitido del proyecto
========================================================= */
app.put(
  "/api/tareas/:id",
  auth,
  requireRole("responsable"),
  async (req, res) => {
    /* =========================================================
       OBTENER ID DE LA TAREA Y DATOS DEL BODY
    ========================================================= */
    const { id } = req.params;
    let { nombre_tarea, horas_Tareas, fechaInicio, fechaFin } = req.body;

    horas_Tareas = Number(horas_Tareas);

    /* =========================================================
       VALIDAR DATOS OBLIGATORIOS
    ========================================================= */
    if (!nombre_tarea || !horas_Tareas || !fechaInicio || !fechaFin) {
      return res.status(400).json({ msg: "Datos incompletos" });
    }

    /* =========================================================
       VALIDAR ORDEN DE FECHAS
    ========================================================= */
    if (fechaFin < fechaInicio) {
      return res.status(400).json({
        msg: "La fecha de fin no puede ser menor que la fecha de inicio",
      });
    }

    try {
      /* =========================================================
         VALIDAR DÍAS FESTIVOS
      ========================================================= */
      const validacionFeriados = await validarFechasNoFeriadas(
        fechaInicio,
        fechaFin,
      );

      if (!validacionFeriados.esValida) {
        return res.status(400).json({
          msg: `No se puede editar la tarea: la fecha ${validacionFeriados.fecha} es día festivo (${validacionFeriados.nombreFeriado}).`,
        });
      }

      /* =========================================================
         CONSULTA SQL
         - Busca a qué actividad pertenece la tarea
         - Se necesita para validar horas y fechas
      ========================================================= */
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

        /* =========================================================
           CONSULTA SQL
           - Suma las horas de las demás tareas de la actividad
           - Excluye la tarea actual para no duplicarla en la suma
        ========================================================= */
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

          /* =========================================================
             CONSULTA SQL
             - Obtiene el total de horas y fechas del proyecto
          ========================================================= */
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

            /* =========================================================
               VALIDAR QUE LA TAREA SIGA DENTRO DEL RANGO
               DEL PROYECTO
            ========================================================= */
            if (
              fechaInicio < fechaProyectoInicio ||
              fechaFin > fechaProyectoFin
            ) {
              return res.status(400).json({
                msg: `La tarea debe estar dentro del rango del proyecto: ${fechaProyectoInicio} a ${fechaProyectoFin}`,
              });
            }

            /* =========================================================
               VALIDAR QUE LAS HORAS NO EXCEDAN EL TOTAL
            ========================================================= */
            if (totalActual + horas_Tareas > horasActividad) {
              return res.status(400).json({
                msg: "Las horas exceden el total de la actividad",
              });
            }

            /* =========================================================
               CONSULTA SQL
               - Actualiza nombre, horas y fechas de la tarea
            ========================================================= */
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

                /* =========================================================
                   RESPUESTA FINAL
                ========================================================= */
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

/* =========================================================
   DELETE - ELIMINAR TAREA
   - Solo el responsable puede eliminar una tarea
   - Elimina el registro de tareas_actividad
   - OJO: si existe relación con cumplimientotarea,
     también se debe borrar esa relación o usar
     ON DELETE CASCADE en la base de datos
========================================================= */
app.delete("/api/tareas/:id", auth, requireRole("responsable"), (req, res) => {
  /* =========================================================
     OBTENER ID DE LA TAREA
  ========================================================= */
  const { id } = req.params;

  /* =========================================================
     CONSULTA SQL
     - Elimina la tarea por su id
  ========================================================= */
  const sql = `
    DELETE FROM tareas_actividad
    WHERE idTareas_Actividad = ?
  `;

  /* =========================================================
     EJECUTAR DELETE
  ========================================================= */
  connection.query(sql, [id], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ msg: "Error al eliminar tarea" });
    }

    /* =========================================================
       RESPUESTA FINAL
    ========================================================= */
    res.json({ success: true });
  });
});

/* =========================
   RESPONSABLES 
========================= */

/* =========================================================
   GET - OBTENER LISTA DE RESPONSABLES
   - Esta ruta devuelve el listado de responsables registrados
   - Se usa para llenar selects, filtros o mostrar nombres
     de responsables en el sistema
   - Devuelve:
       * idresponsable
       * nombre del responsable
========================================================= */
app.get("/api/responsables", auth, (req, res) => {
  /* =========================================================
     CONSULTA SQL
     - Obtiene el id del responsable desde la tabla responsable
     - Une con la tabla usuario para traer el nombre
       del responsable
  ========================================================= */
  const sql = `
    SELECT r.idresponsable, u.nombre
    FROM responsable r
    INNER JOIN usuario u ON r.idusuario = u.idusuario
  `;

  /* =========================================================
     EJECUTAR CONSULTA
     - Si ocurre un error en la base de datos,
       responde con estado 500 y un arreglo vacío
     - Si todo sale bien, devuelve el listado de responsables
       en formato JSON
  ========================================================= */
  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json([]);
    res.json(results);
  });
});

/* =========================================================
   GET - OBTENER EL RESPONSABLE DE UNA ACTIVIDAD
   - Esta ruta devuelve los datos del responsable
     asignado a una actividad específica
   - El id de la actividad se recibe en la URL
   - Devuelve:
       * nombre
       * teléfono
       * ubicación
========================================================= */
app.get("/responsable/:idActividad", auth, (req, res) => {
  /* =========================================================
     OBTENER ID DE LA ACTIVIDAD DESDE LA URL
     - idActividad se toma desde req.params
  ========================================================= */
  const { idActividad } = req.params;

  /* =========================================================
     CONSULTA SQL
     - Parte de la tabla actividad para saber qué responsable
       tiene asignada esa actividad
     - Une con responsable para obtener sus datos propios
     - Une con usuario para traer nombre y teléfono
     - Filtra por idactividad para traer solo el responsable
       de esa actividad
  ========================================================= */
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

  /* =========================================================
     EJECUTAR CONSULTA
     - Se envía idActividad como parámetro
     - Si ocurre un error, responde con estado 500
     - Si todo sale bien, devuelve el primer resultado
       porque una actividad solo debe tener un responsable
  ========================================================= */
  connection.query(sql, [idActividad], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error en servidor" });
    }

    /* =========================================================
       RESPUESTA FINAL
       - Se devuelve el primer registro encontrado
       - Se usa results[0] porque la actividad
         solo debe tener un responsable
    ========================================================= */
    res.json(results[0]);
  });
});

/* =========================
   ALUMNOS 
========================= */

/* =========================================================
   GET - OBTENER LISTA DE ALUMNOS
   - Esta ruta devuelve el listado de alumnos del sistema
   - Si el usuario logueado es tutor, solo devuelve
     los alumnos de los grupos que le pertenecen
   - También calcula:
       * horas_liberadas
       * actividades asignadas del alumno
========================================================= */
app.get("/api/alumnos", auth, (req, res) => {
  /* =========================================================
     CONSULTA SQL BASE
     - Obtiene los datos principales del alumno:
         * matrícula
         * nombre
         * email
         * teléfono
         * grupo
         * cuatrimestre
     - También une con asignacion_actividad y actividad
       para calcular horas liberadas y listar actividades
  ========================================================= */
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

  /* =========================================================
     FILTRO PARA TUTOR
     - Si el usuario logueado tiene rol tutor,
       solo se deben mostrar los alumnos
       de los grupos asignados a ese tutor
     - Para eso se une la tabla tutor
       y se filtra por idusuario
  ========================================================= */
  if (req.user.rol.toLowerCase() === "tutor") {
    sql += `
      INNER JOIN tutor t ON g.idtutor = t.idtutor
      WHERE t.idusuario = ?
    `;
  }

  /* =========================================================
     AGRUPAR RESULTADOS
     - Se agrupa por matrícula para que cada alumno
       aparezca una sola vez
     - Esto también permite usar SUM y GROUP_CONCAT
  ========================================================= */
  sql += " GROUP BY a.matricula";

  /* =========================================================
     PARÁMETROS DE LA CONSULTA
     - Si el usuario es tutor, se envía su id como parámetro
       para el WHERE t.idusuario = ?
     - Si no es tutor, no se envían parámetros
  ========================================================= */
  const params =
    req.user.rol.toLowerCase() === "tutor" ? [req.user.idusuario] : [];

  /* =========================================================
     EJECUTAR CONSULTA
     - Si ocurre un error en la base de datos,
       responde con estado 500 y un arreglo vacío
     - Si todo sale bien, devuelve el listado en JSON
  ========================================================= */
  connection.query(sql, params, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json([]);
    }

    /* =========================================================
       RESPUESTA FINAL
       - Devuelve la lista de alumnos encontrada
    ========================================================= */
    res.json(results);
  });
});

/* =========================================================
   API ASIGNACIÓN (INSCRIPCIÓN DE ALUMNOS)
   - Esta sección permite que un alumno se inscriba
     a una actividad disponible
   - La ruta valida:
       * que el alumno exista
       * que la actividad exista y esté activa
       * que no exceda las 480 horas
       * que no esté ya inscrito
       * que todavía haya cupo
   - Si todo sale bien:
       * crea la asignación en asignacion_actividad
       * crea también los registros iniciales en cumplimientotarea
         para las tareas de esa actividad
========================================================= */

/* =========================================================
   POST - INSCRIBIR ALUMNO A UNA ACTIVIDAD
   - Solo un usuario con rol alumno puede usar esta ruta
   - El id de la actividad se recibe en req.body
========================================================= */
app.post("/api/asignacion", auth, requireRole("alumno"), (req, res) => {
  /* =========================================================
     OBTENER DATOS DEL USUARIO Y DEL BODY
     - idUsuario viene del token validado por auth
     - idactividad llega desde el frontend
  ========================================================= */
  const idUsuario = req.user.idusuario;
  const { idactividad } = req.body;

  /* =========================================================
     CONSULTA SQL
     - Busca la matrícula del alumno usando su idusuario
     - La matrícula se necesita para registrar la asignación
  ========================================================= */
  const sqlAlumno = `SELECT matricula FROM alumno WHERE idusuario = ?`;

  connection.query(sqlAlumno, [idUsuario], (err, resultAlumno) => {
    /* =========================================================
       VALIDAR QUE EL ALUMNO EXISTA
    ========================================================= */
    if (err || resultAlumno.length === 0) {
      return res.status(500).json({ msg: "Alumno no encontrado" });
    }

    /* =========================================================
       OBTENER MATRÍCULA DEL ALUMNO
    ========================================================= */
    const matricula = resultAlumno[0].matricula;

    /* =========================================================
       CONSULTA SQL
       - Busca la actividad a la que el alumno quiere inscribirse
       - Trae:
           * horas_actividad
           * totalAlumnosRequeridos
           * estatus
       - Esto se usa para validar estatus, cupo y horas
    ========================================================= */
    const sqlActividad = `
      SELECT horas_actividad, totalAlumnosRequeridos, estatus
      FROM actividad 
      WHERE idactividad = ?
    `;

    connection.query(sqlActividad, [idactividad], (err2, resultAct) => {
      /* =========================================================
         VALIDAR QUE LA ACTIVIDAD EXISTA
      ========================================================= */
      if (err2 || resultAct.length === 0) {
        return res.status(500).json({ msg: "Actividad no encontrada" });
      }

      /* =========================================================
         OBTENER DATOS DE LA ACTIVIDAD
      ========================================================= */
      const actividad = resultAct[0];

      /* =========================================================
         VALIDAR QUE LA ACTIVIDAD ESTÉ ACTIVA
         - El alumno solo puede inscribirse en actividades activas
      ========================================================= */
      if (actividad.estatus !== "Activa") {
        return res.status(400).json({
          msg: "No puedes inscribirte a una actividad no activa",
        });
      }

      /* =========================================================
         CONSULTA SQL
         - Suma las horas de todas las actividades
           a las que ya está asignado el alumno
         - Sirve para validar que no pase de 480 horas
      ========================================================= */
      const sqlHoras = `
        SELECT IFNULL(SUM(a.horas_actividad), 0) AS total
        FROM asignacion_actividad aa
        JOIN actividad a ON aa.idactividad = a.idactividad
        WHERE aa.matricula = ?
      `;

      connection.query(sqlHoras, [matricula], (errHoras, resultHoras) => {
        /* =========================================================
           VALIDAR SI HUBO ERROR AL CALCULAR LAS HORAS
        ========================================================= */
        if (errHoras) {
          return res.status(500).json({ msg: "Error al calcular horas" });
        }

        /* =========================================================
           OBTENER HORAS ACTUALES Y HORAS DE LA NUEVA ACTIVIDAD
        ========================================================= */
        const totalHoras = Number(resultHoras[0].total) || 0;
        const horasActividad = Number(actividad.horas_actividad) || 0;

        console.log("Horas actuales:", totalHoras);
        console.log("Horas nueva actividad:", horasActividad);
        console.log("Total final:", totalHoras + horasActividad);

        /* =========================================================
           VALIDAR LÍMITE DE 480 HORAS
           - Si el alumno ya llegó a 480, ya no puede inscribirse
           - Si al sumar esta actividad rebasa 480, también se bloquea
        ========================================================= */
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

        /* =========================================================
           CONSULTA SQL
           - Verifica que el alumno no esté ya inscrito
             en esa misma actividad
        ========================================================= */
        const sqlCheck = `
          SELECT * FROM asignacion_actividad 
          WHERE matricula = ? AND idactividad = ?
        `;

        connection.query(
          sqlCheck,
          [matricula, idactividad],
          (errCheck, resultCheck) => {
            /* =========================================================
               VALIDAR ERROR EN LA VERIFICACIÓN
            ========================================================= */
            if (errCheck) {
              return res
                .status(500)
                .json({ msg: "Error al validar inscripción" });
            }

            /* =========================================================
               VALIDAR SI YA ESTÁ INSCRITO
            ========================================================= */
            if (resultCheck.length > 0) {
              return res.status(400).json({
                msg: "Ya estás inscrito en esta actividad",
              });
            }

            /* =========================================================
               CONSULTA SQL
               - Cuenta cuántos alumnos ya están inscritos
                 en la actividad
               - Sirve para validar el cupo disponible
            ========================================================= */
            const sqlCount = `
              SELECT COUNT(*) AS inscritos
              FROM asignacion_actividad
              WHERE idactividad = ?
            `;

            connection.query(sqlCount, [idactividad], (err3, resultCount) => {
              /* =========================================================
                 VALIDAR ERROR AL REVISAR CUPO
              ========================================================= */
              if (err3) {
                return res.status(500).json({ msg: "Error al verificar cupo" });
              }

              /* =========================================================
                 OBTENER TOTAL DE INSCRITOS ACTUALES
              ========================================================= */
              const inscritos = Number(resultCount[0].inscritos) || 0;

              /* =========================================================
                 VALIDAR SI LA ACTIVIDAD YA ESTÁ LLENA
              ========================================================= */
              if (inscritos >= Number(actividad.totalAlumnosRequeridos)) {
                return res.status(400).json({ msg: "Actividad llena" });
              }

              /* =========================================================
                 CONSULTA SQL
                 - Inserta la asignación del alumno a la actividad
                 - El estado inicial queda en 'Pendiente'
              ========================================================= */
              const sqlInsert = `
                INSERT INTO asignacion_actividad (matricula, idactividad, estado)
                VALUES (?, ?, 'Pendiente')
              `;

              connection.query(
                sqlInsert,
                [matricula, idactividad],
                (err4, resultInsert) => {
                  /* =========================================================
                     VALIDAR ERROR AL CREAR LA ASIGNACIÓN
                  ========================================================= */
                  if (err4) {
                    return res
                      .status(500)
                      .json({ msg: "Error al asignar actividad" });
                  }

                  /* =========================================================
                     OBTENER ID DE LA NUEVA ASIGNACIÓN
                     - Se necesita para relacionarla con las tareas
                  ========================================================= */
                  const idAsignacion = resultInsert.insertId;

                  /* =========================================================
                     CONSULTA SQL
                     - Crea registros en cumplimientotarea
                       para todas las tareas que ya tenga la actividad
                     - Cada tarea se registra con estatus 'Pendiente'
                     - Así el alumno ya queda ligado a las tareas
                       desde el momento en que se inscribe
                  ========================================================= */
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
                      /* =========================================================
                         VALIDAR ERROR AL CREAR LAS TAREAS DE CUMPLIMIENTO
                         - Aquí la asignación ya fue creada
                         - Pero falló la parte de ligar las tareas
                      ========================================================= */
                      if (err5) {
                        console.error(err5);
                        return res.status(500).json({
                          msg: "Asignación creada pero error en tareas",
                        });
                      }

                      /* =========================================================
                         RESPUESTA FINAL
                         - La inscripción se hizo correctamente
                         - También se crearon los registros de tareas
                      ========================================================= */
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
PROGRESO DEL ALUMNO
========================================================= */

/* =========================================================
   RUTA: OBTENER PROGRESO DEL ALUMNO LOGUEADO
   - Esta ruta devuelve el resumen general del progreso
     del alumno que ha iniciado sesión
   - Incluye:
       * horas liberadas totales
       * horas faltantes para completar 480
       * actividades inscritas
       * fechas de inicio y término de cada actividad
       * avance de tareas por actividad
========================================================= */
app.get("/api/progreso", auth, requireRole("alumno"), (req, res) => {
  /* =========================================================
     OBTENER ID DEL USUARIO DESDE EL TOKEN
     - req.user fue agregado por el middleware auth
     - idusuario identifica al alumno logueado
  ========================================================= */
  const idUsuario = req.user.idusuario;

  /* =========================================================
     CONSULTA SQL
     - Busca la matrícula del alumno usando su idusuario
     - La matrícula se necesita para consultar sus asignaciones
       y calcular su progreso
  ========================================================= */
  const sqlAlumno = `
    SELECT matricula
    FROM alumno
    WHERE idusuario = ?
  `;

  connection.query(sqlAlumno, [idUsuario], (err, resultAlumno) => {
    /* =========================================================
       VALIDAR QUE EL ALUMNO EXISTA
       - Si ocurre un error o no se encuentra al alumno,
         responde con estado 500
    ========================================================= */
    if (err || !resultAlumno || resultAlumno.length === 0) {
      return res.status(500).json({ msg: "Alumno no encontrado" });
    }

    /* =========================================================
       OBTENER MATRÍCULA DEL ALUMNO
    ========================================================= */
    const matricula = resultAlumno[0].matricula;

    /* =========================================================
       CONSULTA PRINCIPAL DE PROGRESO
       - Obtiene todas las actividades en las que el alumno
         está inscrito
       - Devuelve por cada actividad:
           * idactividad
           * nombreActividad
           * descripcion
           * horas_actividad
           * fecha_alta
           * fechaTermino
           * estado del alumno en la asignación
           * estado general de la actividad
           * horas ganadas por tareas cumplidas
           * total de tareas
           * tareas completadas
       - La consulta parte de asignacion_actividad
         porque ahí está la relación alumno-actividad
       - Se ordena por fecha_alta descendente
         y luego por idactividad descendente
    ========================================================= */
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
      /* =========================================================
         VALIDAR ERROR EN LA CONSULTA PRINCIPAL
      ========================================================= */
      if (err2) {
        console.error("Error en progreso:", err2);
        return res.status(500).json({ msg: "Error al obtener progreso" });
      }

      /* =========================================================
         LIMPIAR Y CONVERTIR TIPOS NUMÉRICOS
         - La base de datos puede devolver algunos valores
           como texto
         - Aquí se convierten a número para trabajar
           correctamente en JavaScript
         - Se normalizan:
             * horas_actividad
             * horas_ganadas
             * total_tareas
             * tareas_completadas
      ========================================================= */
      const actividadesLimpias = (actividades || []).map((act) => ({
        ...act,
        horas_actividad: Number(act.horas_actividad) || 0,
        horas_ganadas: Number(act.horas_ganadas) || 0,
        total_tareas: Number(act.total_tareas) || 0,
        tareas_completadas: Number(act.tareas_completadas) || 0,
      }));

      /* =========================================================
         SUMAR HORAS LIBERADAS DE TODAS LAS ACTIVIDADES
         - Se recorren todas las actividades limpias
         - Se acumulan las horas ganadas del alumno
      ========================================================= */
      let horasLiberadasTotal = 0;

      actividadesLimpias.forEach((act) => {
        horasLiberadasTotal += act.horas_ganadas;
      });

      /* =========================================================
         CALCULAR HORAS FALTANTES PARA LLEGAR A 480
         - Si el alumno ya llegó o superó 480,
           el valor mínimo será 0
      ========================================================= */
      const horasFaltantes = Math.max(0, 480 - horasLiberadasTotal);

      /* =========================================================
         RESPUESTA FINAL
         - Devuelve al frontend:
             * horasLiberadas
             * horasFaltantes
             * actividades con su progreso
      ========================================================= */
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
   - Esta ruta devuelve las tareas de una actividad
     específica para el alumno que ha iniciado sesión
   - Primero valida que el alumno exista
   - Después valida que el alumno sí esté inscrito
     en esa actividad
   - Si la validación es correcta, devuelve:
       * nombre de la actividad
       * tareas de esa actividad
       * horas y estatus de cada tarea
========================================================= */
app.get(
  "/api/progreso/tareas/:idactividad",
  auth,
  requireRole("alumno"),
  (req, res) => {
    /* =========================================================
       OBTENER DATOS DEL USUARIO Y DE LA URL
       - idUsuario se toma del token validado
       - idactividad se toma del parámetro de la URL
       - Number(...) convierte el id a número
    ========================================================= */
    const idUsuario = req.user.idusuario;
    const idactividad = Number(req.params.idactividad);

    /* =========================================================
       VALIDAR ID DE ACTIVIDAD
       - Si no es válido, se detiene el proceso
    ========================================================= */
    if (!idactividad) {
      return res.status(400).json({ msg: "ID de actividad inválido" });
    }

    /* =========================================================
       1. BUSCAR MATRÍCULA DEL ALUMNO
       - Se necesita la matrícula para poder revisar
         si el alumno está inscrito en la actividad
    ========================================================= */
    const sqlAlumno = `
      SELECT matricula
      FROM alumno
      WHERE idusuario = ?
    `;

    connection.query(sqlAlumno, [idUsuario], (err, resultAlumno) => {
      /* =========================================================
         VALIDAR ERROR AL BUSCAR ALUMNO
      ========================================================= */
      if (err) {
        console.error("Error al buscar alumno:", err);
        return res.status(500).json({ msg: "Error al consultar alumno" });
      }

      /* =========================================================
         VALIDAR QUE EL ALUMNO EXISTA
      ========================================================= */
      if (!resultAlumno || resultAlumno.length === 0) {
        return res.status(404).json({ msg: "Alumno no encontrado" });
      }

      /* =========================================================
         OBTENER MATRÍCULA DEL ALUMNO
      ========================================================= */
      const matricula = resultAlumno[0].matricula;

      /* =========================================================
         2. VERIFICAR QUE EL ALUMNO ESTÉ INSCRITO EN ESA ACTIVIDAD
         - Se busca en asignacion_actividad la relación
           entre la matrícula del alumno y la actividad
         - También se obtiene el nombre de la actividad
         - LIMIT 1 asegura un solo resultado
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
          /* =========================================================
             VALIDAR ERROR AL BUSCAR LA ASIGNACIÓN
          ========================================================= */
          if (err2) {
            console.error("Error al buscar asignación:", err2);
            return res
              .status(500)
              .json({ msg: "Error al consultar asignación" });
          }

          /* =========================================================
             VALIDAR QUE EL ALUMNO SÍ ESTÉ INSCRITO
             - Si no existe esa relación, significa que
               la actividad no le pertenece a ese alumno
          ========================================================= */
          if (!resultAsignacion || resultAsignacion.length === 0) {
            return res.status(404).json({
              msg: "No estás inscrito en esta actividad",
            });
          }

          /* =========================================================
             OBTENER DATOS DE LA ASIGNACIÓN
             - idAsignacion se usa para buscar el cumplimiento
               de tareas de ese alumno
             - nombreActividad se devolverá al frontend
          ========================================================= */
          const idAsignacion = resultAsignacion[0].idasignacion_actividad;
          const nombreActividad = resultAsignacion[0].nombreActividad;

          /* =========================================================
             3. OBTENER TAREAS DE LA ACTIVIDAD
             - Se consultan las tareas de esa actividad
             - Se hace LEFT JOIN con cumplimientotarea
               para traer el estatus específico del alumno
             - Si no existe estatus, se usa 'Pendiente'
               con IFNULL
             - Se ordena por fechaInicio y por id de tarea
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
              /* =========================================================
                 VALIDAR ERROR AL OBTENER TAREAS
              ========================================================= */
              if (err3) {
                console.error("Error al consultar tareas:", err3);
                return res.status(500).json({ msg: "Error al obtener tareas" });
              }

              /* =========================================================
                 LIMPIAR DATOS NUMÉRICOS
                 - Convierte horas_Tareas a número
                 - Esto evita problemas si la BD lo devuelve como texto
              ========================================================= */
              const tareasLimpias = (tareas || []).map((t) => ({
                ...t,
                horas_Tareas: Number(t.horas_Tareas) || 0,
              }));

              /* =========================================================
                 RESPUESTA FINAL
                 - Devuelve el nombre de la actividad
                 - Devuelve también el arreglo de tareas
                   ya procesado
              ========================================================= */
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

/* =========================================================
   GET - OBTENER ALUMNOS INSCRITOS EN UNA ACTIVIDAD
   - Esta ruta devuelve el listado de alumnos inscritos
     en una actividad específica
   - Se usa en el módulo de seguimiento del responsable
   - Devuelve por cada alumno:
       * id de la asignación
       * nombre
       * email
       * teléfono
       * matrícula
       * foto de perfil
       * grupo
       * nombre del tutor
       * tareas cumplidas
       * total de tareas
========================================================= */
app.get(
  "/api/seguimiento/alumnos/:idactividad",
  auth,
  requireRole("responsable"),
  (req, res) => {
    /* =========================================================
       OBTENER ID DE LA ACTIVIDAD DESDE LA URL
       - idactividad se toma desde req.params
    ========================================================= */
    const { idactividad } = req.params;

    /* =========================================================
       CONSULTA SQL
       - Parte de asignacion_actividad porque ahí está
         la relación entre alumno y actividad
       - Une con alumno y usuario para traer los datos
         personales del alumno
       - Usa LEFT JOIN con grupo para traer su grupo
       - Usa LEFT JOIN con tutor y usuario para traer
         el nombre del tutor asignado a ese grupo
       - También calcula:
           * tareas_listas -> cuántas tareas tiene cumplidas
           * total_tareas  -> cuántas tareas tiene en total
       - Finalmente ordena los resultados por nombre del alumno
    ========================================================= */
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

    /* =========================================================
       EJECUTAR CONSULTA
       - Se envía idactividad como parámetro
       - Si hay error en la base de datos, responde con 500
       - Si todo sale bien, devuelve el listado de alumnos
         en formato JSON
    ========================================================= */
    connection.query(sql, [idactividad], (err, results) => {
      if (err) {
        console.error("Error al obtener alumnos del seguimiento:", err);
        return res.status(500).json({ error: "Error al obtener alumnos" });
      }

      /* =========================================================
         RESPUESTA FINAL
         - Devuelve la lista de alumnos encontrados
      ========================================================= */
      res.json(results);
    });
  },
);

/* =========================================================
   GET - OBTENER TAREAS DE UN ALUMNO ESPECÍFICO
   - Esta ruta devuelve las tareas asociadas a una asignación
     específica de un alumno
   - Se usa en el módulo de seguimiento del responsable
   - Devuelve por cada tarea:
       * id del cumplimiento
       * nombre de la tarea
       * horas de la tarea
       * estatus actual
========================================================= */
app.get(
  "/api/seguimiento/tareas-alumno/:idasignacion",
  auth,
  requireRole("responsable"),
  (req, res) => {
    /* =========================================================
       OBTENER ID DE LA ASIGNACIÓN DESDE LA URL
       - idasignacion se toma desde req.params
       - Este id corresponde a idasignacion_actividad
    ========================================================= */
    const { idasignacion } = req.params;

    /* =========================================================
       CONSULTA SQL
       - Parte de cumplimientotarea porque ahí está el avance
         de cada tarea para una asignación específica
       - Une con tareas_actividad para traer el nombre
         y las horas de cada tarea
       - Filtra por idAsignacionActividad para obtener
         solo las tareas de ese alumno en esa actividad
    ========================================================= */
    const sql = `
      SELECT 
        ct.idCumplimientoTarea,
        ta.nombre_tarea,
        ta.horas_Tareas,
        ct.estatus
      FROM cumplimientotarea ct
      INNER JOIN tareas_actividad ta 
        ON ct.idTareasActividad = ta.idTareas_Actividad
      WHERE ct.idAsignacionActividad = ?
    `;

    /* =========================================================
       EJECUTAR CONSULTA
       - Se envía idasignacion como parámetro
       - Si hay error en la base de datos, responde con 500
       - Si todo sale bien, devuelve las tareas en JSON
    ========================================================= */
    connection.query(sql, [idasignacion], (err, results) => {
      if (err)
        return res
          .status(500)
          .json({ error: "Error al obtener tareas del alumno" });

      /* =========================================================
         RESPUESTA FINAL
         - Devuelve la lista de tareas encontradas
      ========================================================= */
      res.json(results);
    });
  },
);

/* =========================================================
   PUT - MARCAR TAREA COMO CUMPLIDA O PENDIENTE
   - Esta ruta permite al responsable cambiar el estatus
     de una tarea de un alumno
   - El cambio se hace sobre la tabla cumplimientotarea
   - Después de actualizar la tarea:
       * revisa si el alumno ya completó todas sus tareas
       * actualiza el estado de la asignación del alumno
       * revisa si toda la actividad ya quedó terminada
       * actualiza el estatus de la actividad a Finalizada o Activa
========================================================= */
app.put(
  "/api/seguimiento/marcar-tarea",
  auth,
  requireRole("responsable"),
  (req, res) => {
    /* =========================================================
       OBTENER DATOS DEL BODY
       - idCumplimientoTarea identifica el registro específico
         en la tabla cumplimientotarea
       - nuevoEstatus será normalmente algo como:
           * Pendiente
           * Cumplida
    ========================================================= */
    const { idCumplimientoTarea, nuevoEstatus } = req.body;

    /* =========================================================
       CONSULTA SQL
       - Actualiza el estatus de una tarea específica
         en la tabla cumplimientotarea
       - Se usa el id del registro de cumplimiento
    ========================================================= */
    const sqlUpdate = `
      UPDATE cumplimientotarea
      SET estatus = ?
      WHERE idCumplimientoTarea = ?
    `;

    /* =========================================================
       1. ACTUALIZAR EL ESTATUS DE LA TAREA
    ========================================================= */
    connection.query(
      sqlUpdate,
      [nuevoEstatus, idCumplimientoTarea],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.json({ success: false });
        }

        /* =========================================================
           CONSULTA SQL
           - Busca la relación entre:
               * el registro de cumplimiento
               * la asignación del alumno
               * la actividad
           - Esto permite saber:
               * qué asignación actualizar
               * qué actividad recalcular
        ========================================================= */
        const sqlRelacion = `
          SELECT 
            ct.idAsignacionActividad,
            aa.idactividad
          FROM cumplimientotarea ct
          INNER JOIN asignacion_actividad aa
            ON ct.idAsignacionActividad = aa.idasignacion_actividad
          WHERE ct.idCumplimientoTarea = ?
        `;

        /* =========================================================
           2. OBTENER ID DE ASIGNACIÓN E ID DE ACTIVIDAD
        ========================================================= */
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

            /* =========================================================
               CONSULTA SQL
               - Cuenta cuántas tareas del alumno todavía
                 NO están cumplidas
               - Si el resultado es 0, significa que
                 ya terminó todas sus tareas
            ========================================================= */
            const sqlCheckAlumno = `
              SELECT COUNT(*) AS pendientes
              FROM cumplimientotarea
              WHERE idAsignacionActividad = ?
              AND estatus != 'Cumplida'
            `;

            /* =========================================================
               3. REVISAR SI EL ALUMNO YA COMPLETÓ TODAS SUS TAREAS
            ========================================================= */
            connection.query(
              sqlCheckAlumno,
              [idAsignacion],
              (err3, result3) => {
                if (err3) {
                  console.error(err3);
                  return res.json({ success: true });
                }

                const pendientesAlumno = Number(result3[0].pendientes || 0);

                /* =========================================================
                   ARMAR UPDATE DEL ESTADO DEL ALUMNO EN LA ACTIVIDAD
                   - Si ya no tiene tareas pendientes:
                       estado = 'Completado'
                   - Si todavía tiene pendientes:
                       estado = 'Asignada'
                ========================================================= */
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

                /* =========================================================
                   4. ACTUALIZAR ESTADO DEL ALUMNO EN LA ACTIVIDAD
                ========================================================= */
                connection.query(
                  sqlEstadoAlumno,
                  paramsEstadoAlumno,
                  (err4) => {
                    if (err4) {
                      console.error(err4);
                      return res.json({ success: false });
                    }

                    /* =========================================================
                       CONSULTA SQL
                       - Cuenta cuántos registros de cumplimiento
                         de TODA la actividad todavía NO están cumplidos
                       - Se hace uniendo cumplimientotarea con
                         asignacion_actividad para filtrar por actividad
                    ========================================================= */
                    const sqlCheckActividad = `
                      SELECT COUNT(*) AS pendientesActividad
                      FROM cumplimientotarea ct
                      INNER JOIN asignacion_actividad aa
                        ON ct.idAsignacionActividad = aa.idasignacion_actividad
                      WHERE aa.idactividad = ?
                      AND ct.estatus != 'Cumplida'
                    `;

                    /* =========================================================
                       5. REVISAR SI TODA LA ACTIVIDAD YA QUEDÓ FINALIZADA
                    ========================================================= */
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

                        /* =========================================================
                           CONSULTA SQL
                           - Cuenta cuántos alumnos están inscritos
                             en la actividad
                           - Esto se revisa para no marcar una actividad
                             vacía como Finalizada por error
                        ========================================================= */
                        const sqlInscritos = `
                          SELECT COUNT(*) AS inscritos
                          FROM asignacion_actividad
                          WHERE idactividad = ?
                        `;

                        /* =========================================================
                           6. CONTAR ALUMNOS INSCRITOS EN LA ACTIVIDAD
                        ========================================================= */
                        connection.query(
                          sqlInscritos,
                          [idactividad],
                          (err6, result6) => {
                            if (err6) {
                              console.error(err6);
                              return res.json({ success: true });
                            }

                            const inscritos = Number(result6[0].inscritos || 0);

                            /* =========================================================
                               ARMAR UPDATE DEL ESTATUS DE LA ACTIVIDAD
                               - Si hay inscritos y ya no quedan pendientes:
                                   estatus = 'Finalizada'
                               - Si todavía faltan tareas:
                                   estatus = 'Activa'
                               - No modifica actividades Canceladas ni Pendientes
                                 en el caso de regresarla a Activa
                            ========================================================= */
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
                              sqlEstadoActividad = `
                                UPDATE actividad
                                SET estatus = 'Activa'
                                WHERE idactividad = ?
                                AND estatus NOT IN ('Cancelada', 'Pendiente')
                              `;
                              paramsEstadoActividad = [idactividad];
                            }

                            /* =========================================================
                               7. ACTUALIZAR ESTATUS FINAL DE LA ACTIVIDAD
                            ========================================================= */
                            connection.query(
                              sqlEstadoActividad,
                              paramsEstadoActividad,
                              (err7) => {
                                if (err7) {
                                  console.error(err7);
                                  return res.json({ success: false });
                                }

                                /* =========================================================
                                   RESPUESTA FINAL
                                   - Si todo salió bien, devuelve success: true
                                ========================================================= */
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

// app.listen inicia el servidor en el puerto definido y muestra un mensaje en consola
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

