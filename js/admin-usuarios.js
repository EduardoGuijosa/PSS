/* =========================================================
   VALIDAR SESIÓN
========================================================= */
(function validarSesion() {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol")?.toLowerCase();

  if (!usuario || !rol) {
    window.location.replace("/index.html");
    return;
  }

  if (rol !== "administrador") {
    alert("No tienes permisos para entrar al panel de administración.");
    window.location.replace("/html/portada.html");
  }
})();

/* =========================================================
   VARIABLES GLOBALES
========================================================= */
let tipoRegistroActual = "alumno";
let registrosOriginales = [];
let textoBusqueda = "";

/* =========================================================
   REFERENCIAS DEL DOM
========================================================= */
const formularioAdminContainer = document.getElementById(
  "formularioAdminContainer",
);
const tituloFormulario = document.getElementById("tituloFormulario");
const tituloListado = document.getElementById("tituloListado");
const alertaAdmin = document.getElementById("alertaAdmin");
const cardFormularioAdmin = document.getElementById("cardFormularioAdmin");
const btnNuevoRegistro = document.getElementById("btnNuevoRegistro");
const btnCerrarFormulario = document.getElementById("btnCerrarFormulario");
const buscarRegistroAdmin = document.getElementById("buscarRegistroAdmin");
const btnLimpiarBusquedaAdmin = document.getElementById(
  "btnLimpiarBusquedaAdmin",
);
const labelBusquedaAdmin = document.getElementById("labelBusquedaAdmin");
const theadAdminUsuarios = document.getElementById("theadAdminUsuarios");
const listaAdminUsuarios = document.getElementById("listaAdminUsuarios");

/* =========================================================
   ENDPOINTS
========================================================= */
const ENDPOINTS_ADMIN = {
  registrarAlumno: "http://127.0.0.1:3000/api/admin/registrar-alumno",
  registrarTutor: "http://127.0.0.1:3000/api/admin/registrar-tutor",
  registrarResponsable: "http://127.0.0.1:3000/api/admin/registrar-responsable",
  registrarSubdirector: "http://127.0.0.1:3000/api/admin/registrar-subdirector",
  grupos: "http://127.0.0.1:3000/api/admin/grupos",

  listarAlumnos: "http://127.0.0.1:3000/api/admin/listado/alumnos",
  listarTutores: "http://127.0.0.1:3000/api/admin/listado/tutores",
  listarResponsables: "http://127.0.0.1:3000/api/admin/listado/responsables",
  listarSubdirectores: "http://127.0.0.1:3000/api/admin/listado/subdirectores",
};

/* =========================================================
   HEADERS
========================================================= */
function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + localStorage.getItem("token"),
  };
}

/* =========================================================
   UTILIDADES
========================================================= */
function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function mostrarAlerta(mensaje, tipo = "success") {
  if (!alertaAdmin) return;
  alertaAdmin.className = `alert alert-${tipo}`;
  alertaAdmin.textContent = mensaje;
  alertaAdmin.classList.remove("d-none");
}

function ocultarAlerta() {
  if (!alertaAdmin) return;
  alertaAdmin.className = "alert d-none";
  alertaAdmin.textContent = "";
}

function mostrarFormulario() {
  cardFormularioAdmin.style.display = "block";
}

function ocultarFormulario() {
  cardFormularioAdmin.style.display = "none";
  ocultarAlerta();
  formularioAdminContainer.innerHTML = "";
}

function obtenerTituloListado() {
  if (tipoRegistroActual === "alumno") return "Alumnos registrados";
  if (tipoRegistroActual === "tutor") return "Tutores registrados";
  if (tipoRegistroActual === "responsable") return "Responsables registrados";
  if (tipoRegistroActual === "subdirector") return "Subdirectores registrados";
  return "Registros";
}

function obtenerTituloFormulario() {
  if (tipoRegistroActual === "alumno") return "Nuevo alumno";
  if (tipoRegistroActual === "tutor") return "Nuevo tutor";
  if (tipoRegistroActual === "responsable") return "Nuevo responsable";
  if (tipoRegistroActual === "subdirector") return "Nuevo subdirector";
  return "Nuevo registro";
}

function obtenerTextoBoton() {
  if (tipoRegistroActual === "alumno") return "+ Nuevo alumno";
  if (tipoRegistroActual === "tutor") return "+ Nuevo tutor";
  if (tipoRegistroActual === "responsable") return "+ Nuevo responsable";
  if (tipoRegistroActual === "subdirector") return "+ Nuevo subdirector";
  return "+ Nuevo";
}

function obtenerPlaceholderBusqueda() {
  if (tipoRegistroActual === "alumno") {
    return "Buscar por nombre, correo, matrícula o grupo...";
  }
  if (tipoRegistroActual === "tutor") {
    return "Buscar por nombre, correo o grupo asignado...";
  }
  if (tipoRegistroActual === "responsable") {
    return "Buscar por nombre, correo o ubicación...";
  }
  if (tipoRegistroActual === "subdirector") {
    return "Buscar por nombre, correo o teléfono...";
  }
  return "Buscar registro...";
}

function obtenerEndpointListado() {
  if (tipoRegistroActual === "alumno") return ENDPOINTS_ADMIN.listarAlumnos;
  if (tipoRegistroActual === "tutor") return ENDPOINTS_ADMIN.listarTutores;
  if (tipoRegistroActual === "responsable")
    return ENDPOINTS_ADMIN.listarResponsables;
  if (tipoRegistroActual === "subdirector")
    return ENDPOINTS_ADMIN.listarSubdirectores;
  return "";
}

function obtenerEndpointRegistro() {
  if (tipoRegistroActual === "alumno") return ENDPOINTS_ADMIN.registrarAlumno;
  if (tipoRegistroActual === "tutor") return ENDPOINTS_ADMIN.registrarTutor;
  if (tipoRegistroActual === "responsable")
    return ENDPOINTS_ADMIN.registrarResponsable;
  if (tipoRegistroActual === "subdirector")
    return ENDPOINTS_ADMIN.registrarSubdirector;
  return "";
}

/* =========================================================
   TARJETAS ACTIVAS
========================================================= */
function actualizarTarjetasActivas() {
  const tarjetas = {
    alumno: document.getElementById("cardAlumno"),
    tutor: document.getElementById("cardTutor"),
    responsable: document.getElementById("cardResponsable"),
    subdirector: document.getElementById("cardSubdirector"),
  };

  Object.values(tarjetas).forEach((card) => {
    if (card) card.classList.remove("active");
  });

  if (tarjetas[tipoRegistroActual]) {
    tarjetas[tipoRegistroActual].classList.add("active");
  }
}

/* =========================================================
   PLANTILLAS DE FORMULARIOS
========================================================= */
function plantillaAlumno() {
  return `
    <form id="formAdmin">

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Matrícula</label>
          <input type="text" class="form-control" name="matricula" required />
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
          <input type="text" class="form-control" name="nombre" required />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Correo</label>
          <input type="email" class="form-control" name="email" required />
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Teléfono</label>
          <input type="text" class="form-control" name="telefono" required />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Contraseña</label>
          <input type="password" class="form-control" name="password" required />
        </div>
      </div>

      <div class="admin-actions">
        <button type="submit" class="btn btn-primary">Guardar Alumno</button>
        <button type="button" class="btn btn-outline-secondary" onclick="limpiarFormularioAdmin()">
          Limpiar
        </button>
      </div>
    </form>
  `;
}

function plantillaTutor() {
  return `
    <form id="formAdmin">
      <div class="admin-form-note">
        El tutor podrá ser asignado posteriormente desde el módulo de Gestión de Grupos.
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Nombre completo</label>
          <input type="text" class="form-control" name="nombre" required />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Correo</label>
          <input type="email" class="form-control" name="email" required />
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Teléfono</label>
          <input type="text" class="form-control" name="telefono" required />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Contraseña</label>
          <input type="password" class="form-control" name="password" required />
        </div>
      </div>

      <div class="admin-actions">
        <button type="submit" class="btn btn-success">Guardar Tutor</button>
        <button type="button" class="btn btn-outline-secondary" onclick="limpiarFormularioAdmin()">
          Limpiar
        </button>
      </div>
    </form>
  `;
}

function plantillaResponsable() {
  return `
    <form id="formAdmin">
      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Nombre completo</label>
          <input type="text" class="form-control" name="nombre" required />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Correo</label>
          <input type="email" class="form-control" name="email" required />
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Teléfono</label>
          <input type="text" class="form-control" name="telefono" required />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Contraseña</label>
          <input type="password" class="form-control" name="password" required />
        </div>
      </div>

      <div class="admin-actions">
        <button type="submit" class="btn btn-info text-white">Guardar Responsable</button>
        <button type="button" class="btn btn-outline-secondary" onclick="limpiarFormularioAdmin()">
          Limpiar
        </button>
      </div>
    </form>
  `;
}

function plantillaSubdirector() {
  return `
    <form id="formAdmin">
      <div class="admin-form-note">
        Este registro se mostrará como <strong>Subdirector</strong> en la interfaz,
        pero temporalmente lo guardaremos en el sistema como <strong>Director</strong>.
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Nombre completo</label>
          <input type="text" class="form-control" name="nombre" required />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Correo</label>
          <input type="email" class="form-control" name="email" required />
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Teléfono</label>
          <input type="text" class="form-control" name="telefono" required />
        </div>

        <div class="col-md-6 mb-3">
          <label class="form-label">Contraseña</label>
          <input type="password" class="form-control" name="password" required />
        </div>
      </div>

      <div class="admin-actions">
        <button type="submit" class="btn btn-dark">Guardar Subdirector</button>
        <button type="button" class="btn btn-outline-secondary" onclick="limpiarFormularioAdmin()">
          Limpiar
        </button>
      </div>
    </form>
  `;
}

/* =========================================================
   CARGAR GRUPOS EN SELECT
========================================================= */
async function cargarGruposEnSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    const res = await fetch(ENDPOINTS_ADMIN.grupos, {
      headers: getHeaders(),
    });

    const grupos = await res.json();

    if (!res.ok) {
      console.error("Error al cargar grupos:", grupos);
      return;
    }

    select.innerHTML = `<option value="">Selecciona un grupo</option>`;

    grupos.forEach((grupo) => {
      select.innerHTML += `
        <option value="${grupo.idgrupo}">
          ${grupo.grupo} - ${grupo.turno}
        </option>
      `;
    });
  } catch (error) {
    console.error("Error al cargar grupos en select:", error);
  }
}

/* =========================================================
   RENDER FORMULARIO
========================================================= */
function renderizarFormulario() {
  tituloFormulario.textContent = obtenerTituloFormulario();

  if (tipoRegistroActual === "alumno") {
    formularioAdminContainer.innerHTML = plantillaAlumno();
  }

  if (tipoRegistroActual === "tutor") {
    formularioAdminContainer.innerHTML = plantillaTutor();
  }

  if (tipoRegistroActual === "responsable") {
    formularioAdminContainer.innerHTML = plantillaResponsable();
  }

  if (tipoRegistroActual === "subdirector") {
    formularioAdminContainer.innerHTML = plantillaSubdirector();
  }

  const formAdmin = document.getElementById("formAdmin");
  if (formAdmin) {
    formAdmin.addEventListener("submit", enviarFormularioAdmin);
  }

  if (tipoRegistroActual === "alumno") {
    cargarGruposEnSelect("selectGrupoAlumno");
  }
}

/* =========================================================
   TABLA
========================================================= */
function renderizarEncabezadoTabla() {
  if (tipoRegistroActual === "alumno") {
    theadAdminUsuarios.innerHTML = `
      <tr>
        <th>Matrícula</th>
        <th>Nombre</th>
        <th>Correo</th>
        <th>Teléfono</th>
        <th>Grupo</th>
      </tr>
    `;
  }

  if (tipoRegistroActual === "tutor") {
    theadAdminUsuarios.innerHTML = `
      <tr>
        <th>Nombre</th>
        <th>Correo</th>
        <th>Teléfono</th>
        <th>Grupo asignado</th>
      </tr>
    `;
  }

  if (tipoRegistroActual === "responsable") {
    theadAdminUsuarios.innerHTML = `
      <tr>
        <th>Nombre</th>
        <th>Correo</th>
        <th>Teléfono</th>
        <th>Ubicación</th>
      </tr>
    `;
  }

  if (tipoRegistroActual === "subdirector") {
    theadAdminUsuarios.innerHTML = `
      <tr>
        <th>Nombre</th>
        <th>Correo</th>
        <th>Teléfono</th>
      </tr>
    `;
  }
}

function renderizarTabla(registros) {
  if (!listaAdminUsuarios) return;

  listaAdminUsuarios.innerHTML = "";

  if (!registros || registros.length === 0) {
    const columnas =
      tipoRegistroActual === "subdirector"
        ? 3
        : tipoRegistroActual === "tutor"
          ? 4
          : tipoRegistroActual === "responsable"
            ? 4
            : 5;

    listaAdminUsuarios.innerHTML = `
      <tr>
        <td colspan="${columnas}" class="text-center text-muted py-4">
          No se encontraron registros.
        </td>
      </tr>
    `;
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
        </tr>
      `;
    }

    if (tipoRegistroActual === "tutor") {
      listaAdminUsuarios.innerHTML += `
        <tr>
          <td class="fw-bold text-success">${escaparHTML(item.nombre)}</td>
          <td>${escaparHTML(item.email || "Sin correo")}</td>
          <td>${escaparHTML(item.telefono || "Sin teléfono")}</td>
          <td>${escaparHTML(item.grupo || "Sin grupo asignado")}</td>
        </tr>
      `;
    }

    if (tipoRegistroActual === "responsable") {
      listaAdminUsuarios.innerHTML += `
        <tr>
          <td class="fw-bold text-info">${escaparHTML(item.nombre)}</td>
          <td>${escaparHTML(item.email || "Sin correo")}</td>
          <td>${escaparHTML(item.telefono || "Sin teléfono")}</td>
          <td>${escaparHTML(item.ubicacion || "No especificada")}</td>
        </tr>
      `;
    }

    if (tipoRegistroActual === "subdirector") {
      listaAdminUsuarios.innerHTML += `
        <tr>
          <td class="fw-bold text-dark">${escaparHTML(item.nombre)}</td>
          <td>${escaparHTML(item.email || "Sin correo")}</td>
          <td>${escaparHTML(item.telefono || "Sin teléfono")}</td>
        </tr>
      `;
    }
  });
}

/* =========================================================
   CARGAR LISTADOS
========================================================= */
async function cargarListado() {
  const endpoint = obtenerEndpointListado();

  if (!endpoint) return;

  listaAdminUsuarios.innerHTML = `
    <tr>
      <td colspan="6" class="text-center text-muted py-4">
        Cargando registros...
      </td>
    </tr>
  `;

  try {
    const res = await fetch(endpoint, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Error al cargar listado:", data);
      renderizarTabla([]);
      return;
    }

    registrosOriginales = Array.isArray(data) ? data : [];
    aplicarFiltroTabla();
  } catch (error) {
    console.error("Error de conexión al cargar listado:", error);
    renderizarTabla([]);
  }
}

/* =========================================================
   FILTRO TABLA
========================================================= */
function aplicarFiltroTabla() {
  let filtrados = [...registrosOriginales];
  const texto = textoBusqueda.trim().toLowerCase();

  if (texto) {
    filtrados = filtrados.filter((item) => {
      const campos = [
        item.nombre,
        item.email,
        item.telefono,
        item.matricula,
        item.grupo,
        item.ubicacion,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return campos.includes(texto);
    });
  }

  renderizarTabla(filtrados);
}

/* =========================================================
   SELECCIONAR TIPO
========================================================= */
function seleccionarTipoRegistro(tipo) {
  tipoRegistroActual = tipo;
  textoBusqueda = "";
  if (buscarRegistroAdmin) buscarRegistroAdmin.value = "";

  actualizarTarjetasActivas();
  tituloListado.textContent = obtenerTituloListado();
  tituloFormulario.textContent = obtenerTituloFormulario();
  btnNuevoRegistro.textContent = obtenerTextoBoton();
  buscarRegistroAdmin.placeholder = obtenerPlaceholderBusqueda();
  labelBusquedaAdmin.textContent = `Buscar ${tipoRegistroActual}`;

  ocultarFormulario();
  renderizarEncabezadoTabla();
  cargarListado();
}

/* =========================================================
   LIMPIAR FORMULARIO
========================================================= */
function limpiarFormularioAdmin() {
  const formAdmin = document.getElementById("formAdmin");
  if (formAdmin) formAdmin.reset();
  ocultarAlerta();
}

/* =========================================================
   NUEVO REGISTRO
========================================================= */
function abrirNuevoRegistro() {
  mostrarFormulario();
  renderizarFormulario();
  ocultarAlerta();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================================================
   ENVIAR FORMULARIO
========================================================= */
async function enviarFormularioAdmin(e) {
  e.preventDefault();
  ocultarAlerta();

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  if (tipoRegistroActual === "subdirector") {
    data.rolSistema = "director";
  }

  try {
    const url = obtenerEndpointRegistro();

    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    const respuesta = await res.json();

    if (!res.ok) {
      mostrarAlerta(
        respuesta.msg || respuesta.error || "Error al guardar el registro.",
        "danger",
      );
      return;
    }

    mostrarAlerta("Registro guardado correctamente.", "success");
    e.target.reset();
    await cargarListado();
  } catch (error) {
    console.error("Error al guardar desde admin:", error);
    mostrarAlerta("Error de conexión con el servidor.", "danger");
  }
}

/* =========================================================
   QUERYSTRING
========================================================= */
function leerTipoDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const tipo = params.get("tipo");

  if (
    tipo === "alumno" ||
    tipo === "tutor" ||
    tipo === "responsable" ||
    tipo === "subdirector"
  ) {
    tipoRegistroActual = tipo;
  }
}

/* =========================================================
   EVENTOS
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  leerTipoDesdeURL();
  actualizarTarjetasActivas();
  tituloListado.textContent = obtenerTituloListado();
  tituloFormulario.textContent = obtenerTituloFormulario();
  btnNuevoRegistro.textContent = obtenerTextoBoton();
  buscarRegistroAdmin.placeholder = obtenerPlaceholderBusqueda();
  renderizarEncabezadoTabla();
  cargarListado();
});

if (btnNuevoRegistro) {
  btnNuevoRegistro.addEventListener("click", abrirNuevoRegistro);
}

if (btnCerrarFormulario) {
  btnCerrarFormulario.addEventListener("click", ocultarFormulario);
}

if (buscarRegistroAdmin) {
  buscarRegistroAdmin.addEventListener("input", (e) => {
    textoBusqueda = e.target.value;
    aplicarFiltroTabla();
  });
}

if (btnLimpiarBusquedaAdmin) {
  btnLimpiarBusquedaAdmin.addEventListener("click", () => {
    textoBusqueda = "";
    if (buscarRegistroAdmin) buscarRegistroAdmin.value = "";
    aplicarFiltroTabla();
  });
}

/* =========================================================
   FUNCIONES GLOBALES
========================================================= */
window.seleccionarTipoRegistro = seleccionarTipoRegistro;
window.limpiarFormularioAdmin = limpiarFormularioAdmin;
