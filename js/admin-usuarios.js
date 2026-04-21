// =========================================================
// VALIDAR SESIÓN Y PERMISOS DE ADMINISTRADOR
// =========================================================
(function validarSesion() {
  const usuario = localStorage.getItem("usuario"); // obtiene el nombre del usuario guardado en localStorage
  const rol = localStorage.getItem("rol")?.toLowerCase(); // obtiene el rol y lo pasa a minúsculas para compararlo mejor

  if (!usuario || !rol) {
    // si no existe usuario o rol, significa que no hay sesión válida
    window.location.replace("/index.html"); // manda al login
    return;
  }

  if (rol !== "administrador") {
    // si el rol no es administrador, bloquea el acceso a este panel
    alert("No tienes permisos para entrar al panel de administración."); // avisa al usuario
    window.location.replace("/html/portada.html"); // lo regresa a portada
  }
})();

// =========================================================
// VARIABLES GLOBALES
// =========================================================
let tipoRegistroActual = "alumno"; // tipo de registro que se está administrando actualmente
let registrosOriginales = []; // aquí se guardan los registros cargados desde el backend
let textoBusqueda = ""; // texto actual del buscador
let modoFormulario = "nuevo"; // indica si el modal está en modo nuevo o editar
let idUsuarioEditando = null; // guarda el id del usuario que se está editando
let modalAdminInstance = null; // guardará la instancia Bootstrap del modal

// =========================================================
// REFERENCIAS DEL DOM
// =========================================================
const formularioAdminContainer = document.getElementById(
  "formularioAdminContainer", // contenedor donde se renderiza dinámicamente el formulario
);
const tituloListado = document.getElementById("tituloListado"); // título del listado
const tituloModalAdmin = document.getElementById("tituloModalAdmin"); // título del modal
const alertaAdminModal = document.getElementById("alertaAdminModal"); // alerta dentro del modal
const btnNuevoRegistro = document.getElementById("btnNuevoRegistro"); // botón para abrir modal de nuevo registro
const buscarRegistroAdmin = document.getElementById("buscarRegistroAdmin"); // input de búsqueda
const btnLimpiarBusquedaAdmin = document.getElementById(
  "btnLimpiarBusquedaAdmin", // botón para limpiar búsqueda
);
const labelBusquedaAdmin = document.getElementById("labelBusquedaAdmin"); // label del buscador
const theadAdminUsuarios = document.getElementById("theadAdminUsuarios"); // encabezado de la tabla
const listaAdminUsuarios = document.getElementById("listaAdminUsuarios"); // cuerpo de la tabla
const btnGuardarModal = document.getElementById("btnGuardarModal"); // botón guardar del modal
const modalAdminRegistro = document.getElementById("modalAdminRegistro"); // elemento del modal

// =========================================================
// ENDPOINTS
// =========================================================
const API_BASE = "http://127.0.0.1:3000"; // base general del backend

const ENDPOINTS_ADMIN = {
  registrarAlumno: `${API_BASE}/api/admin/registrar-alumno`, // endpoint para registrar alumno
  registrarTutor: `${API_BASE}/api/admin/registrar-tutor`, // endpoint para registrar tutor
  registrarResponsable: `${API_BASE}/api/admin/registrar-responsable`, // endpoint para registrar responsable
  registrarSubdirector: `${API_BASE}/api/admin/registrar-subdirector`, // endpoint para registrar subdirector
  grupos: `${API_BASE}/api/admin/grupos`, // endpoint para obtener grupos

  listarAlumnos: `${API_BASE}/api/admin/listado/alumnos`, // endpoint para listar alumnos
  listarTutores: `${API_BASE}/api/admin/listado/tutores`, // endpoint para listar tutores
  listarResponsables: `${API_BASE}/api/admin/listado/responsables`, // endpoint para listar responsables
  listarSubdirectores: `${API_BASE}/api/admin/listado/subdirectores`, // endpoint para listar subdirectores
};

// =========================================================
// HEADERS
// =========================================================
function getHeaders() {
  return {
    "Content-Type": "application/json", // indica que el body se enviará como JSON
    Authorization: "Bearer " + localStorage.getItem("token"), // manda el token JWT para autenticar
  };
}

// =========================================================
// UTILIDADES
// =========================================================
function escaparHTML(valor) {
  return String(valor ?? "") // convierte a string y evita null/undefined
    .replaceAll("&", "&amp;") // escapa &
    .replaceAll("<", "&lt;") // escapa <
    .replaceAll(">", "&gt;") // escapa >
    .replaceAll('"', "&quot;") // escapa comillas dobles
    .replaceAll("'", "&#39;"); // escapa comillas simples
}

function mostrarAlertaModal(mensaje, tipo = "success") {
  if (!alertaAdminModal) return; // si no existe el contenedor, sale

  alertaAdminModal.className = `alert alert-${tipo}`; // asigna clases Bootstrap según el tipo
  alertaAdminModal.textContent = mensaje; // coloca el texto del mensaje
  alertaAdminModal.classList.remove("d-none"); // hace visible la alerta
}

function ocultarAlertaModal() {
  if (!alertaAdminModal) return; // si no existe la alerta, sale

  alertaAdminModal.className = "alert d-none"; // la oculta
  alertaAdminModal.textContent = ""; // limpia el texto
}

function obtenerTituloListado() {
  if (tipoRegistroActual === "alumno") return "Alumnos registrados"; // título para alumnos
  if (tipoRegistroActual === "tutor") return "Tutores registrados"; // título para tutores
  if (tipoRegistroActual === "responsable") return "Responsables registrados"; // título para responsables
  if (tipoRegistroActual === "subdirector") return "Subdirectores registrados"; // título para subdirectores
  return "Registros"; // fallback por seguridad
}

function obtenerTextoBoton() {
  if (tipoRegistroActual === "alumno") return "+ Nuevo alumno"; // texto del botón nuevo alumno
  if (tipoRegistroActual === "tutor") return "+ Nuevo tutor"; // texto del botón nuevo tutor
  if (tipoRegistroActual === "responsable") return "+ Nuevo responsable"; // texto del botón nuevo responsable
  if (tipoRegistroActual === "subdirector") return "+ Nuevo subdirector"; // texto del botón nuevo subdirector
  return "+ Nuevo"; // fallback general
}

function obtenerPlaceholderBusqueda() {
  if (tipoRegistroActual === "alumno") {
    return "Buscar por nombre, correo, matrícula, grupo o estatus..."; // placeholder para búsqueda de alumnos
  }
  if (tipoRegistroActual === "tutor") {
    return "Buscar por nombre, correo, grupo o estatus..."; // placeholder para tutores
  }
  if (tipoRegistroActual === "responsable") {
    return "Buscar por nombre, correo, ubicación o estatus..."; // placeholder para responsables
  }
  if (tipoRegistroActual === "subdirector") {
    return "Buscar por nombre, correo, teléfono o estatus..."; // placeholder para subdirectores
  }
  return "Buscar registro..."; // placeholder por defecto
}

function obtenerEndpointListado() {
  if (tipoRegistroActual === "alumno") return ENDPOINTS_ADMIN.listarAlumnos; // endpoint de listado de alumnos
  if (tipoRegistroActual === "tutor") return ENDPOINTS_ADMIN.listarTutores; // endpoint de listado de tutores
  if (tipoRegistroActual === "responsable")
    return ENDPOINTS_ADMIN.listarResponsables; // endpoint de listado de responsables
  if (tipoRegistroActual === "subdirector")
    return ENDPOINTS_ADMIN.listarSubdirectores; // endpoint de listado de subdirectores
  return ""; // si no coincide, regresa vacío
}

function obtenerEndpointRegistro() {
  if (tipoRegistroActual === "alumno") return ENDPOINTS_ADMIN.registrarAlumno; // endpoint de registro de alumno
  if (tipoRegistroActual === "tutor") return ENDPOINTS_ADMIN.registrarTutor; // endpoint de registro de tutor
  if (tipoRegistroActual === "responsable")
    return ENDPOINTS_ADMIN.registrarResponsable; // endpoint de registro de responsable
  if (tipoRegistroActual === "subdirector")
    return ENDPOINTS_ADMIN.registrarSubdirector; // endpoint de registro de subdirector
  return ""; // fallback
}

function obtenerEndpointDetalle(tipo, idusuario) {
  return `${API_BASE}/api/admin/usuarios/${tipo}/${idusuario}`; // arma endpoint para ver o actualizar un usuario según tipo e id
}

function obtenerEndpointEstatus(tipo, idusuario) {
  return `${API_BASE}/api/admin/usuarios/${tipo}/${idusuario}/estatus`; // arma endpoint para cambiar estatus de un usuario
}

function obtenerTituloModal() {
  const accion = modoFormulario === "editar" ? "Editar" : "Nuevo"; // define si el modal es para crear o editar

  if (tipoRegistroActual === "alumno") return `${accion} alumno`; // título dinámico para alumno
  if (tipoRegistroActual === "tutor") return `${accion} tutor`; // título dinámico para tutor
  if (tipoRegistroActual === "responsable") return `${accion} responsable`; // título dinámico para responsable
  if (tipoRegistroActual === "subdirector") return `${accion} subdirector`; // título dinámico para subdirector

  return `${accion} registro`; // fallback
}

function obtenerTextoGuardarModal() {
  if (modoFormulario === "editar") return "Guardar cambios"; // si es edición, el botón dice guardar cambios

  if (tipoRegistroActual === "alumno") return "Guardar alumno"; // texto para alta de alumno
  if (tipoRegistroActual === "tutor") return "Guardar tutor"; // texto para alta de tutor
  if (tipoRegistroActual === "responsable") return "Guardar responsable"; // texto para alta de responsable
  if (tipoRegistroActual === "subdirector") return "Guardar subdirector"; // texto para alta de subdirector

  return "Guardar"; // fallback
}

function obtenerClaseTextoTipo() {
  if (tipoRegistroActual === "alumno") return "text-primary"; // color asociado a alumno
  if (tipoRegistroActual === "tutor") return "text-success"; // color asociado a tutor
  if (tipoRegistroActual === "responsable") return "text-info"; // color asociado a responsable
  if (tipoRegistroActual === "subdirector") return "text-dark"; // color asociado a subdirector
  return "text-primary"; // fallback
}

function obtenerBadgeEstatus(estatus) {
  const valor = String(estatus || "activo").toLowerCase(); // normaliza el estatus recibido

  let clase = "estado-activo"; // clase visual por defecto
  let texto = "Activo"; // texto por defecto

  if (valor === "inactivo") {
    clase = "estado-inactivo"; // clase para inactivo
    texto = "Inactivo"; // texto para inactivo
  }

  if (valor === "baja_temporal") {
    clase = "estado-baja"; // clase para baja temporal
    texto = "Baja temporal"; // texto para baja temporal
  }

  return `<span class="estado-badge ${clase}">${texto}</span>`; // devuelve el badge HTML listo para insertar
}

function limpiarFormularioAdmin() {
  const formAdmin = document.getElementById("formAdmin"); // obtiene el formulario dinámico actual
  if (formAdmin) formAdmin.reset(); // si existe, lo limpia
  ocultarAlertaModal(); // también limpia alertas del modal
}

function resetearModalAdmin() {
  formularioAdminContainer.innerHTML = ""; // vacía el contenedor del formulario
  ocultarAlertaModal(); // oculta alertas del modal
  modoFormulario = "nuevo"; // reinicia el modo a nuevo
  idUsuarioEditando = null; // limpia el id del usuario que se estaba editando
}

function actualizarControlesCabecera() {
  tituloListado.textContent = obtenerTituloListado(); // actualiza título del listado
  btnNuevoRegistro.textContent = obtenerTextoBoton(); // actualiza texto del botón nuevo
  buscarRegistroAdmin.placeholder = obtenerPlaceholderBusqueda(); // actualiza placeholder del buscador
  labelBusquedaAdmin.textContent = `Buscar ${tipoRegistroActual}`; // actualiza label del buscador
}

// =========================================================
// TARJETAS ACTIVAS
// =========================================================
function actualizarTarjetasActivas() {
  const tarjetas = {
    alumno: document.getElementById("cardAlumno"), // tarjeta de alumnos
    tutor: document.getElementById("cardTutor"), // tarjeta de tutores
    responsable: document.getElementById("cardResponsable"), // tarjeta de responsables
    subdirector: document.getElementById("cardSubdirector"), // tarjeta de subdirectores
  };

  Object.values(tarjetas).forEach((card) => {
    if (card) card.classList.remove("active"); // quita la clase active a todas
  });

  if (tarjetas[tipoRegistroActual]) {
    tarjetas[tipoRegistroActual].classList.add("active"); // activa solo la tarjeta del tipo actual
  }
}

// =========================================================
// PLANTILLAS DE FORMULARIOS
// =========================================================
function plantillaSelectEstatus(estatus = "activo") {
  const valor = String(estatus || "activo").toLowerCase(); // toma el estatus actual y lo normaliza

  return `
    <div class="col-md-6 mb-3">
      <label class="form-label">Estatus</label>
      <select class="form-select" name="estatus" required>
        <option value="activo" ${valor === "activo" ? "selected" : ""}>Activo</option>
        <option value="inactivo" ${valor === "inactivo" ? "selected" : ""}>Inactivo</option>
        <option value="baja_temporal" ${valor === "baja_temporal" ? "selected" : ""}>Baja temporal</option>
      </select>
    </div>
  `; // devuelve select HTML con la opción actual marcada
}

function plantillaAlumno(valores = {}) {
  const esEdicion = modoFormulario === "editar"; // determina si el modal está en edición

  return `
    <form id="formAdmin">
      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Matrícula</label>
          <input
            type="text"
            class="form-control"
            name="matricula"
            value="${escaparHTML(valores.matricula || "")}"
            required
          />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Grupo</label>
          <select class="form-select" name="idgrupo" id="selectGrupoAlumno" required>
            <option value="">Selecciona un grupo</option>
          </select>
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Nombre completo</label>
          <input
            type="text"
            class="form-control"
            name="nombre"
            value="${escaparHTML(valores.nombre || "")}"
            required
          />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Correo</label>
          <input
            type="email"
            class="form-control"
            name="email"
            value="${escaparHTML(valores.email || "")}"
            required
          />
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Teléfono</label>
          <input
            type="text"
            class="form-control"
            name="telefono"
            value="${escaparHTML(valores.telefono || "")}"
            required
          />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">${
            esEdicion ? "Nueva contraseña (opcional)" : "Contraseña"
          }</label>
          <input
            type="password"
            class="form-control"
            name="password"
            ${esEdicion ? "" : "required"}
          />
        </div>
      </div>

      ${
        esEdicion
          ? `<div class="row">${plantillaSelectEstatus(valores.estatus || "activo")}</div>`
          : ""
      }
    </form>
  `; // devuelve formulario dinámico de alumno; en edición agrega selector de estatus
}

function plantillaTutor(valores = {}) {
  const esEdicion = modoFormulario === "editar"; // verifica si es edición

  return `
    <form id="formAdmin">
      <div class="admin-form-note">
        El tutor podrá ser asignado posteriormente desde el módulo de Gestión de Grupos.
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Nombre completo</label>
          <input
            type="text"
            class="form-control"
            name="nombre"
            value="${escaparHTML(valores.nombre || "")}"
            required
          />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Correo</label>
          <input
            type="email"
            class="form-control"
            name="email"
            value="${escaparHTML(valores.email || "")}"
            required
          />
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Teléfono</label>
          <input
            type="text"
            class="form-control"
            name="telefono"
            value="${escaparHTML(valores.telefono || "")}"
            required
          />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">${
            esEdicion ? "Nueva contraseña (opcional)" : "Contraseña"
          }</label>
          <input
            type="password"
            class="form-control"
            name="password"
            ${esEdicion ? "" : "required"}
          />
        </div>
      </div>

      ${
        esEdicion
          ? `<div class="row">${plantillaSelectEstatus(valores.estatus || "activo")}</div>`
          : ""
      }
    </form>
  `; // devuelve formulario de tutor
}

function plantillaResponsable(valores = {}) {
  const esEdicion = modoFormulario === "editar"; // verifica si es edición

  return `
    <form id="formAdmin">
      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Nombre completo</label>
          <input
            type="text"
            class="form-control"
            name="nombre"
            value="${escaparHTML(valores.nombre || "")}"
            required
          />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Correo</label>
          <input
            type="email"
            class="form-control"
            name="email"
            value="${escaparHTML(valores.email || "")}"
            required
          />
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Teléfono</label>
          <input
            type="text"
            class="form-control"
            name="telefono"
            value="${escaparHTML(valores.telefono || "")}"
            required
          />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">${
            esEdicion ? "Nueva contraseña (opcional)" : "Contraseña"
          }</label>
          <input
            type="password"
            class="form-control"
            name="password"
            ${esEdicion ? "" : "required"}
          />
        </div>
      </div>

      ${
        esEdicion
          ? `
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label">Ubicación</label>
                <input
                  type="text"
                  class="form-control"
                  name="ubicacion"
                  value="${escaparHTML(valores.ubicacion || "No especificada")}"
                />
              </div>
              ${plantillaSelectEstatus(valores.estatus || "activo")}
            </div>
          `
          : ""
      }
    </form>
  `; // devuelve formulario de responsable; en edición agrega ubicación y estatus
}

function plantillaSubdirector(valores = {}) {
  const esEdicion = modoFormulario === "editar"; // verifica si es edición

  return `
    <form id="formAdmin">
      <div class="admin-form-note">
        Este registro se mostrará como <strong>Subdirector</strong> en la interfaz,
        pero temporalmente se guarda en el sistema como <strong>Director</strong>.
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Nombre completo</label>
          <input
            type="text"
            class="form-control"
            name="nombre"
            value="${escaparHTML(valores.nombre || "")}"
            required
          />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Correo</label>
          <input
            type="email"
            class="form-control"
            name="email"
            value="${escaparHTML(valores.email || "")}"
            required
          />
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Teléfono</label>
          <input
            type="text"
            class="form-control"
            name="telefono"
            value="${escaparHTML(valores.telefono || "")}"
            required
          />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">${
            esEdicion ? "Nueva contraseña (opcional)" : "Contraseña"
          }</label>
          <input
            type="password"
            class="form-control"
            name="password"
            ${esEdicion ? "" : "required"}
          />
        </div>
      </div>

      ${
        esEdicion
          ? `<div class="row">${plantillaSelectEstatus(valores.estatus || "activo")}</div>`
          : ""
      }
    </form>
  `; // devuelve formulario de subdirector
}

// =========================================================
// CARGAR GRUPOS EN SELECT
// =========================================================
async function cargarGruposEnSelect(selectId, grupoSeleccionado = "") {
  const select = document.getElementById(selectId); // obtiene el select por id
  if (!select) return; // si no existe, sale

  try {
    const res = await fetch(ENDPOINTS_ADMIN.grupos, {
      headers: getHeaders(), // manda token
    });

    const grupos = await res.json(); // lee respuesta JSON

    if (!res.ok) {
      console.error("Error al cargar grupos:", grupos); // si hubo error del backend, lo muestra
      return;
    }

    select.innerHTML = `<option value="">Selecciona un grupo</option>`; // opción inicial

    grupos.forEach((grupo) => {
      select.innerHTML += `
        <option value="${grupo.idgrupo}">
          ${escaparHTML(grupo.grupo)} - ${escaparHTML(grupo.turno)}
        </option>
      `; // agrega cada grupo como opción
    });

    if (grupoSeleccionado) {
      select.value = String(grupoSeleccionado); // si viene un grupo ya elegido, lo selecciona
    }
  } catch (error) {
    console.error("Error al cargar grupos en select:", error); // error de red o fetch
  }
}

// =========================================================
// RENDER FORMULARIO MODAL
// =========================================================
async function renderizarFormularioModal(valores = {}) {
  tituloModalAdmin.textContent = obtenerTituloModal(); // actualiza título del modal
  btnGuardarModal.textContent = obtenerTextoGuardarModal(); // actualiza texto del botón guardar
  btnGuardarModal.className = `btn btn-primary ${obtenerClaseTextoTipo() === "text-dark" ? "btn-dark" : "btn-primary"}`; // cambia color del botón según tipo actual

  if (tipoRegistroActual === "alumno") {
    formularioAdminContainer.innerHTML = plantillaAlumno(valores); // renderiza formulario de alumno
    await cargarGruposEnSelect("selectGrupoAlumno", valores.idgrupo || ""); // llena el select de grupos
  }

  if (tipoRegistroActual === "tutor") {
    formularioAdminContainer.innerHTML = plantillaTutor(valores); // renderiza formulario de tutor
  }

  if (tipoRegistroActual === "responsable") {
    formularioAdminContainer.innerHTML = plantillaResponsable(valores); // renderiza formulario de responsable
  }

  if (tipoRegistroActual === "subdirector") {
    formularioAdminContainer.innerHTML = plantillaSubdirector(valores); // renderiza formulario de subdirector
  }

  const formAdmin = document.getElementById("formAdmin"); // obtiene el formulario recién insertado
  if (formAdmin) {
    formAdmin.addEventListener("submit", enviarFormularioAdmin); // le agrega el evento submit
  }
}

// =========================================================
// TABLA
// =========================================================
function renderizarEncabezadoTabla() {
  if (tipoRegistroActual === "alumno") {
    theadAdminUsuarios.innerHTML = `
      <tr>
        <th>Matrícula</th>
        <th>Nombre</th>
        <th>Correo</th>
        <th>Teléfono</th>
        <th>Grupo</th>
        <th>Estatus</th>
        <th>Acciones</th>
      </tr>
    `; // encabezado para alumnos
  }

  if (tipoRegistroActual === "tutor") {
    theadAdminUsuarios.innerHTML = `
      <tr>
        <th>Nombre</th>
        <th>Correo</th>
        <th>Teléfono</th>
        <th>Grupo asignado</th>
        <th>Estatus</th>
        <th>Acciones</th>
      </tr>
    `; // encabezado para tutores
  }

  if (tipoRegistroActual === "responsable") {
    theadAdminUsuarios.innerHTML = `
      <tr>
        <th>Nombre</th>
        <th>Correo</th>
        <th>Teléfono</th>
        <th>Ubicación</th>
        <th>Estatus</th>
        <th>Acciones</th>
      </tr>
    `; // encabezado para responsables
  }

  if (tipoRegistroActual === "subdirector") {
    theadAdminUsuarios.innerHTML = `
      <tr>
        <th>Nombre</th>
        <th>Correo</th>
        <th>Teléfono</th>
        <th>Estatus</th>
        <th>Acciones</th>
      </tr>
    `; // encabezado para subdirectores
  }
}

function obtenerColspanTabla() {
  if (tipoRegistroActual === "alumno") return 7; // columnas del listado de alumnos
  if (tipoRegistroActual === "tutor") return 6; // columnas del listado de tutores
  if (tipoRegistroActual === "responsable") return 6; // columnas del listado de responsables
  if (tipoRegistroActual === "subdirector") return 5; // columnas del listado de subdirectores
  return 6; // fallback
}

function renderizarBotonesAccion(item) {
  const tipo = tipoRegistroActual; // guarda el tipo actual
  const id = item.idusuario; // toma el idusuario del registro
  const estatus = String(item.estatus || "activo").toLowerCase(); // normaliza el estatus

  const botonEstatus =
    estatus === "activo"
      ? `
        <button
          type="button"
          class="btn btn-sm btn-outline-danger"
          onclick="cambiarEstatusRegistro('${tipo}', ${id}, 'inactivo')"
        >
          Eliminar
        </button>
      `
      : `
        <button
          type="button"
          class="btn btn-sm btn-outline-success"
          onclick="cambiarEstatusRegistro('${tipo}', ${id}, 'activo')"
        >
          Reactivar
        </button>
      `; // si está activo muestra botón para inactivar, si no muestra reactivar

  return `
    <div class="acciones-admin">
      <button
        type="button"
        class="btn btn-sm btn-outline-primary"
        onclick="editarRegistroAdmin('${tipo}', ${id})"
      >
        Editar
      </button>
      ${botonEstatus}
    </div>
  `; // devuelve HTML con botón editar y botón de estatus
}

function renderizarTabla(registros) {
  if (!listaAdminUsuarios) return; // valida que exista el contenedor

  listaAdminUsuarios.innerHTML = ""; // limpia la tabla antes de volver a renderizar

  if (!registros || registros.length === 0) {
    listaAdminUsuarios.innerHTML = `
      <tr>
        <td colspan="${obtenerColspanTabla()}" class="text-center text-muted py-4">
          No se encontraron registros.
        </td>
      </tr>
    `; // muestra mensaje cuando no hay registros
    return;
  }

  registros.forEach((item) => {
    if (tipoRegistroActual === "alumno") {
      listaAdminUsuarios.innerHTML += `
        <tr>
          <td class="fw-bold text-primary">${escaparHTML(item.matricula)}</td>
          <td>${escaparHTML(item.nombre)}</td>
          <td>${escaparHTML(item.email || "Sin correo")}</td>
          <td>${escaparHTML(item.telefono || "Sin teléfono")}</td>
          <td>${escaparHTML(item.grupo || "Sin grupo")}</td>
          <td>${obtenerBadgeEstatus(item.estatus)}</td>
          <td>${renderizarBotonesAccion(item)}</td>
        </tr>
      `; // agrega fila de alumno
    }

    if (tipoRegistroActual === "tutor") {
      listaAdminUsuarios.innerHTML += `
        <tr>
          <td class="fw-bold text-success">${escaparHTML(item.nombre)}</td>
          <td>${escaparHTML(item.email || "Sin correo")}</td>
          <td>${escaparHTML(item.telefono || "Sin teléfono")}</td>
          <td>${escaparHTML(item.grupo || "Sin grupo asignado")}</td>
          <td>${obtenerBadgeEstatus(item.estatus)}</td>
          <td>${renderizarBotonesAccion(item)}</td>
        </tr>
      `; // agrega fila de tutor
    }

    if (tipoRegistroActual === "responsable") {
      listaAdminUsuarios.innerHTML += `
        <tr>
          <td class="fw-bold text-info">${escaparHTML(item.nombre)}</td>
          <td>${escaparHTML(item.email || "Sin correo")}</td>
          <td>${escaparHTML(item.telefono || "Sin teléfono")}</td>
          <td>${escaparHTML(item.ubicacion || "No especificada")}</td>
          <td>${obtenerBadgeEstatus(item.estatus)}</td>
          <td>${renderizarBotonesAccion(item)}</td>
        </tr>
      `; // agrega fila de responsable
    }

    if (tipoRegistroActual === "subdirector") {
      listaAdminUsuarios.innerHTML += `
        <tr>
          <td class="fw-bold text-dark">${escaparHTML(item.nombre)}</td>
          <td>${escaparHTML(item.email || "Sin correo")}</td>
          <td>${escaparHTML(item.telefono || "Sin teléfono")}</td>
          <td>${obtenerBadgeEstatus(item.estatus)}</td>
          <td>${renderizarBotonesAccion(item)}</td>
        </tr>
      `; // agrega fila de subdirector
    }
  });
}

// =========================================================
// CARGAR LISTADOS
// =========================================================
async function cargarListado() {
  const endpoint = obtenerEndpointListado(); // obtiene el endpoint según el tipo actual

  if (!endpoint) return; // si no hay endpoint, sale

  listaAdminUsuarios.innerHTML = `
    <tr>
      <td colspan="${obtenerColspanTabla()}" class="text-center text-muted py-4">
        Cargando registros...
      </td>
    </tr>
  `; // muestra mensaje de carga mientras espera respuesta

  try {
    const res = await fetch(endpoint, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"), // manda token
      },
    });

    const data = await res.json(); // lee respuesta del backend

    if (!res.ok) {
      console.error("Error al cargar listado:", data); // muestra error si backend respondió mal
      renderizarTabla([]); // renderiza tabla vacía
      return;
    }

    registrosOriginales = Array.isArray(data) ? data : []; // guarda listado original
    aplicarFiltroTabla(); // aplica búsqueda actual y renderiza
  } catch (error) {
    console.error("Error de conexión al cargar listado:", error); // error de red
    renderizarTabla([]); // deja tabla vacía
  }
}

// =========================================================
// FILTRO TABLA
// =========================================================
function aplicarFiltroTabla() {
  let filtrados = [...registrosOriginales]; // crea copia para trabajar
  const texto = textoBusqueda.trim().toLowerCase(); // toma texto del buscador en minúsculas

  if (texto) {
    filtrados = filtrados.filter((item) => {
      const campos = [
        item.nombre, // nombre
        item.email, // correo
        item.telefono, // teléfono
        item.matricula, // matrícula
        item.grupo, // grupo
        item.ubicacion, // ubicación
        item.estatus, // estatus
      ]
        .filter(Boolean) // elimina vacíos
        .join(" ") // une todo en un solo string
        .toLowerCase(); // lo pasa a minúsculas

      return campos.includes(texto); // deja pasar si el texto existe en alguno de los campos
    });
  }

  renderizarTabla(filtrados); // renderiza tabla filtrada
}

// =========================================================
// SELECCIONAR TIPO
// =========================================================
function seleccionarTipoRegistro(tipo) {
  tipoRegistroActual = tipo; // cambia el tipo actual de registro
  textoBusqueda = ""; // limpia la búsqueda guardada

  if (buscarRegistroAdmin) buscarRegistroAdmin.value = ""; // limpia visualmente el input

  actualizarTarjetasActivas(); // actualiza tarjeta seleccionada
  actualizarControlesCabecera(); // actualiza títulos y textos
  renderizarEncabezadoTabla(); // cambia encabezado de tabla
  cargarListado(); // vuelve a cargar el listado del nuevo tipo
}

// =========================================================
// ABRIR MODAL NUEVO
// =========================================================
async function abrirNuevoRegistro() {
  modoFormulario = "nuevo"; // pone el modal en modo nuevo
  idUsuarioEditando = null; // limpia id de edición
  ocultarAlertaModal(); // limpia alertas
  await renderizarFormularioModal(); // genera el formulario del tipo actual
  modalAdminInstance.show(); // abre el modal
}

// =========================================================
// EDITAR REGISTRO
// =========================================================
async function editarRegistroAdmin(tipo, idusuario) {
  try {
    const res = await fetch(obtenerEndpointDetalle(tipo, idusuario), {
      headers: getHeaders(), // manda token y JSON
    });

    const data = await res.json(); // obtiene los datos del usuario

    if (!res.ok) {
      alert(data.msg || data.error || "No se pudo cargar el registro."); // muestra mensaje si algo salió mal
      return;
    }

    tipoRegistroActual = tipo; // actualiza tipo actual
    modoFormulario = "editar"; // pone el modal en modo edición
    idUsuarioEditando = idusuario; // guarda el id del usuario que se va a editar

    actualizarTarjetasActivas(); // refresca tarjeta activa
    actualizarControlesCabecera(); // refresca cabecera
    renderizarEncabezadoTabla(); // refresca encabezado de tabla

    await renderizarFormularioModal(data); // genera formulario ya con valores del usuario
    modalAdminInstance.show(); // abre el modal
  } catch (error) {
    console.error("Error al cargar registro:", error); // error de red
    alert("Error de conexión al obtener el registro.");
  }
}

// =========================================================
// CAMBIAR ESTATUS
// =========================================================
async function cambiarEstatusRegistro(tipo, idusuario, nuevoEstatus) {
  const accion =
    nuevoEstatus === "activo" ? "reactivar" : "marcar como inactivo"; // texto de confirmación según acción

  const confirmado = confirm(`¿Seguro que deseas ${accion} este registro?`); // pide confirmación

  if (!confirmado) return; // si cancela, termina

  try {
    const res = await fetch(obtenerEndpointEstatus(tipo, idusuario), {
      method: "PUT", // usa PUT para cambiar estatus
      headers: getHeaders(), // manda token y JSON
      body: JSON.stringify({ estatus: nuevoEstatus }), // manda nuevo estatus
    });

    const data = await res.json(); // lee respuesta

    if (!res.ok) {
      alert(data.msg || data.error || "No se pudo actualizar el estatus."); // avisa si hubo error
      return;
    }

    await cargarListado(); // si salió bien, recarga la tabla
  } catch (error) {
    console.error("Error al actualizar estatus:", error); // error de red
    alert("Error de conexión al actualizar el estatus.");
  }
}

// =========================================================
// ENVIAR FORMULARIO
// =========================================================
async function enviarFormularioAdmin(e) {
  e.preventDefault(); // evita recarga del formulario
  ocultarAlertaModal(); // limpia alerta previa

  const formData = new FormData(e.target); // toma todos los campos del formulario
  const data = Object.fromEntries(formData.entries()); // convierte FormData a objeto simple

  try {
    let url = ""; // aquí se guardará el endpoint final
    let metodo = "POST"; // por defecto será POST para nuevos registros

    if (modoFormulario === "editar") {
      url = obtenerEndpointDetalle(tipoRegistroActual, idUsuarioEditando); // si es edición usa endpoint detalle
      metodo = "PUT"; // cambia a PUT
    } else {
      url = obtenerEndpointRegistro(); // si es nuevo usa endpoint de registro
    }

    const res = await fetch(url, {
      method: metodo, // POST o PUT
      headers: getHeaders(), // manda token y JSON
      body: JSON.stringify(data), // envía datos del formulario
    });

    const respuesta = await res.json(); // lee respuesta del backend

    if (!res.ok) {
      mostrarAlertaModal(
        respuesta.msg || respuesta.error || "Error al guardar el registro.", // muestra mensaje de error dentro del modal
        "danger",
      );
      return;
    }

    modalAdminInstance.hide(); // cierra el modal si salió bien
    await cargarListado(); // recarga tabla actualizada
  } catch (error) {
    console.error("Error al guardar desde admin:", error); // error de red
    mostrarAlertaModal("Error de conexión con el servidor.", "danger");
  }
}

// =========================================================
// QUERYSTRING
// =========================================================
function leerTipoDesdeURL() {
  const params = new URLSearchParams(window.location.search); // obtiene los parámetros de la URL
  const tipo = params.get("tipo"); // lee el parámetro tipo

  if (
    tipo === "alumno" || // tipo válido alumno
    tipo === "tutor" || // tipo válido tutor
    tipo === "responsable" || // tipo válido responsable
    tipo === "subdirector" // tipo válido subdirector
  ) {
    tipoRegistroActual = tipo; // si es válido, lo usa como tipo actual
  }
}

// =========================================================
// EVENTOS
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  modalAdminInstance = new bootstrap.Modal(modalAdminRegistro); // crea instancia Bootstrap del modal

  modalAdminRegistro.addEventListener("hidden.bs.modal", () => {
    resetearModalAdmin(); // cuando el modal se cierra, lo limpia por completo
  });

  leerTipoDesdeURL(); // revisa si la URL trae tipo preseleccionado
  actualizarTarjetasActivas(); // marca tarjeta activa
  actualizarControlesCabecera(); // actualiza textos de cabecera
  renderizarEncabezadoTabla(); // dibuja encabezado según tipo
  cargarListado(); // carga registros iniciales
});

if (btnNuevoRegistro) {
  btnNuevoRegistro.addEventListener("click", abrirNuevoRegistro); // abre modal para crear nuevo registro
}

if (buscarRegistroAdmin) {
  buscarRegistroAdmin.addEventListener("input", (e) => {
    textoBusqueda = e.target.value; // actualiza texto del buscador en tiempo real
    aplicarFiltroTabla(); // vuelve a filtrar tabla
  });
}

if (btnLimpiarBusquedaAdmin) {
  btnLimpiarBusquedaAdmin.addEventListener("click", () => {
    textoBusqueda = ""; // limpia texto de búsqueda guardado
    if (buscarRegistroAdmin) buscarRegistroAdmin.value = ""; // limpia input visual
    aplicarFiltroTabla(); // vuelve a renderizar tabla sin filtro
  });
}

// =========================================================
// FUNCIONES GLOBALES
// =========================================================
window.seleccionarTipoRegistro = seleccionarTipoRegistro; // expone función para cambiar tipo desde HTML
window.limpiarFormularioAdmin = limpiarFormularioAdmin; // expone función para limpiar formulario
window.editarRegistroAdmin = editarRegistroAdmin; // expone función para editar registro
window.cambiarEstatusRegistro = cambiarEstatusRegistro; // expone función para cambiar estatus
