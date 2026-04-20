/* =========================================================
   VALIDAR SESIÓN
========================================================= */
(function validarSesion() {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol")?.toLowerCase();

  if (!usuario || !rol) {
    window.location.replace("/index.html");
  }
})();

/* =========================================================
   URLS DE LAS APIs
========================================================= */
const API_URL = "http://127.0.0.1:3000/api/actividad";
const API_URL_ASIGNACION = "http://127.0.0.1:3000/api/asignacion";
const API_TAREAS = "http://127.0.0.1:3000/api/tareas";

/* =========================================================
   VARIABLES GLOBALES DEL DOM
========================================================= */
let listaActividades;
let sinActividades;
let resumenProyectos;
let contenedorFiltros;

let modal;
let modalTareas;
let modalFormTarea;

let inputId;
let inputNombre;
let inputDescripcion;
let inputAlumnos;
let inputHoras;
let inputInicio;
let inputFin;
let inputEstatus;

let inputTareaId;
let inputNombreTarea;
let inputHorasTarea;
let inputFechaInicioTarea;
let inputFechaFinTarea;

let tituloModalActividad;
let textoBtnGuardarProyecto;
let inputBuscar;
let inputFiltroHoras;
let contenedorBusquedaResponsable;
let contenedorFiltroHorasAlumno;
let nombreActividadModal;
let infoHoras;
let tablaTareas;
let btnNuevaTarea;

/* =========================================================
   VARIABLES DE ESTADO
========================================================= */
let rolActual = "";
let idActividadActual = null;
let filtroEstatus = "Todos";
let textoBusqueda = "";
let filtroHoras = "Todos";
let actividadesOriginales = [];
let tareasActuales = [];

/* =========================================================
   FUNCIÓN PARA HEADERS
========================================================= */
function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + localStorage.getItem("token"),
  };
}

/* =========================================================
   FUNCIÓN PARA CERRAR SESIÓN
========================================================= */
function cerrarSesion() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  localStorage.removeItem("rol");
  window.location.replace("/index.html");
}

/* =========================================================
   UTILIDADES GENERALES
========================================================= */
async function leerJSONSeguro(res) {
  const texto = await res.text();

  try {
    return texto ? JSON.parse(texto) : {};
  } catch (error) {
    console.error("La respuesta no vino en JSON válido:", texto);
    return {};
  }
}

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";

  const soloFecha = String(fecha).includes("T")
    ? String(fecha).split("T")[0]
    : String(fecha);

  const partes = soloFecha.split("-");

  if (partes.length !== 3) return "Sin fecha";

  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

function fechaInput(fecha) {
  if (!fecha) return "";
  return String(fecha).includes("T")
    ? String(fecha).split("T")[0]
    : String(fecha);
}

function obtenerClaseStatus(estatus) {
  if (estatus === "Activa") return "status-activa";
  if (estatus === "Pendiente") return "status-pendiente";
  if (estatus === "Cancelada") return "status-cancelada";
  return "status-finalizada";
}

function obtenerClaseBarraProgreso(estatus, porcentaje) {
  if (estatus === "Cancelada") return "progreso-cancelada";
  if (estatus === "Finalizada") return "progreso-finalizada";
  if (estatus === "Pendiente") return "progreso-pendiente";
  if (porcentaje >= 100) return "progreso-finalizada";
  return "progreso-activa";
}

function contarPorEstatus(actividades) {
  const conteo = {
    Todos: actividades.length,
    Pendiente: 0,
    Activa: 0,
    Finalizada: 0,
    Cancelada: 0,
  };

  actividades.forEach((act) => {
    if (conteo[act.estatus] !== undefined) {
      conteo[act.estatus]++;
    }
  });

  return conteo;
}

function buscarActividadPorId(idactividad) {
  return actividadesOriginales.find(
    (act) => Number(act.idactividad) === Number(idactividad),
  );
}

function buscarTareaPorId(idTarea) {
  return tareasActuales.find(
    (tarea) => Number(tarea.idTareas_Actividad) === Number(idTarea),
  );
}

/* =========================================================
   VALIDAR RANGO DE HORAS
========================================================= */
function cumpleFiltroHoras(horasActividad) {
  const horas = Number(horasActividad || 0);

  if (filtroHoras === "Todos") return true;
  if (filtroHoras === "1-100") return horas >= 1 && horas <= 100;
  if (filtroHoras === "101-200") return horas >= 101 && horas <= 200;
  if (filtroHoras === "201-300") return horas >= 201 && horas <= 300;
  if (filtroHoras === "301-480") return horas >= 301 && horas <= 480;

  return true;
}

/* =========================================================
   INICIO DE LA PÁGINA
========================================================= */
window.addEventListener("load", () => {
  listaActividades = document.getElementById("listaActividades");
  sinActividades = document.getElementById("sinActividades");
  resumenProyectos = document.getElementById("resumenProyectos");
  contenedorFiltros = document.getElementById("contenedorFiltros");

  inputId = document.getElementById("actividadId");
  inputNombre = document.getElementById("nombreActividad");
  inputDescripcion = document.getElementById("descripcion");
  inputHoras = document.getElementById("horas");
  inputAlumnos = document.getElementById("totalAlumnos");
  inputInicio = document.getElementById("fechaInicio");
  inputFin = document.getElementById("fechaFin");
  inputEstatus = document.getElementById("editEstatus");

  inputTareaId = document.getElementById("tareaId");
  inputNombreTarea = document.getElementById("nombreTarea");
  inputHorasTarea = document.getElementById("horasTarea");
  inputFechaInicioTarea = document.getElementById("fechaInicioTarea");
  inputFechaFinTarea = document.getElementById("fechaFinTarea");

  tituloModalActividad = document.getElementById("tituloModalActividad");
  textoBtnGuardarProyecto = document.getElementById("textoBtnGuardarProyecto");

  inputBuscar = document.getElementById("buscarResponsable");
  inputFiltroHoras = document.getElementById("filtroHoras");
  contenedorBusquedaResponsable = document.getElementById(
    "contenedorBusquedaResponsable",
  );
  contenedorFiltroHorasAlumno = document.getElementById(
    "contenedorFiltroHorasAlumno",
  );

  nombreActividadModal = document.getElementById("nombreActividadModal");
  infoHoras = document.getElementById("infoHoras");
  tablaTareas = document.getElementById("tablaTareas");
  btnNuevaTarea = document.getElementById("btnNuevaTarea");

  modal = new bootstrap.Modal(document.getElementById("modalActividad"));
  modalTareas = new bootstrap.Modal(document.getElementById("modalTareas"));
  modalFormTarea = new bootstrap.Modal(
    document.getElementById("modalFormTarea"),
  );

  rolActual = localStorage.getItem("rol")?.toLowerCase() || "";

  configurarVistaSegunRol();

  if (inputBuscar) {
    inputBuscar.addEventListener("input", (e) => {
      textoBusqueda = e.target.value;
      aplicarFiltros();
    });
  }

  if (inputFiltroHoras) {
    inputFiltroHoras.addEventListener("change", (e) => {
      filtroHoras = e.target.value;
      aplicarFiltros();
    });
  }

  document
    .getElementById("formActividad")
    .addEventListener("submit", guardarActividad);
  document.getElementById("formTarea").addEventListener("submit", guardarTarea);

  cargarActividades();
});

/* =========================================================
   CONFIGURAR VISTA SEGÚN ROL
========================================================= */
function configurarVistaSegunRol() {
  const btnNuevo = document.getElementById("btnNuevaActividad");

  if (rolActual !== "responsable" && btnNuevo) {
    btnNuevo.style.display = "none";
  }

  if (rolActual === "responsable") {
    if (contenedorBusquedaResponsable) {
      contenedorBusquedaResponsable.style.display = "none";
    }
  } else {
    if (contenedorBusquedaResponsable) {
      contenedorBusquedaResponsable.style.display = "block";
    }
  }

  if (rolActual === "alumno") {
    if (contenedorFiltroHorasAlumno) {
      contenedorFiltroHorasAlumno.style.display = "block";
    }
  } else {
    if (contenedorFiltroHorasAlumno) {
      contenedorFiltroHorasAlumno.style.display = "none";
    }
  }

  if (rolActual !== "responsable" && filtroEstatus === "Pendiente") {
    filtroEstatus = "Todos";
  }
}

/* =========================================================
   CARGAR ACTIVIDADES DESDE LA API
========================================================= */
async function cargarActividades() {
  try {
    const res = await fetch(API_URL, {
      headers: getHeaders(),
    });

    if (res.status === 401) {
      cerrarSesion();
      return;
    }

    const data = await leerJSONSeguro(res);

    if (!res.ok) {
      console.error("Error en el servidor al cargar actividades:", data);
      alert(data.msg || "No se pudieron cargar los proyectos.");
      return;
    }

    if (data?.sinPeriodo) {
      actividadesOriginales = [];
      alert(
        data.msg ||
          "Tu grupo aún no tiene definido su periodo de servicio social.",
      );
      aplicarFiltros();
      return;
    }

    actividadesOriginales = Array.isArray(data) ? data : [];
    aplicarFiltros();
  } catch (error) {
    console.error("Error al cargar actividades:", error);
    alert("Error de conexión con el servidor.");
  }
}

/* =========================================================
   RENDERIZAR RESUMEN
========================================================= */
function renderizarResumen(actividadesBase) {
  const total = actividadesBase.length;

  // Solo el alumno verá la barra azul grande
  if (rolActual !== "alumno") {
    resumenProyectos.innerHTML = "";
    resumenProyectos.style.display = "none";
    return;
  }

  resumenProyectos.style.display = "block";
  resumenProyectos.innerHTML = `
    <div class="resumen-card">
      <div class="resumen-label">Total de proyectos</div>
      <div class="resumen-value">${total}</div>
    </div>
  `;
}

/* =========================================================
   RENDERIZAR FILTROS
========================================================= */
function renderizarFiltros(actividadesBase) {
  if (rolActual === "alumno") {
    contenedorFiltros.innerHTML = "";
    return;
  }

  const conteo = contarPorEstatus(actividadesBase);

  const filtros = [
    {
      estatus: "Todos",
      etiqueta: "Todos",
      cantidad: conteo.Todos,
      clase: "filtro-todos",
    },
  ];

  if (rolActual === "responsable") {
    filtros.push({
      estatus: "Pendiente",
      etiqueta: "Pendientes",
      cantidad: conteo.Pendiente,
      clase: "filtro-pendiente",
    });
  }

  filtros.push(
    {
      estatus: "Activa",
      etiqueta: "Activas",
      cantidad: conteo.Activa,
      clase: "filtro-activa",
    },
    {
      estatus: "Finalizada",
      etiqueta: "Finalizadas",
      cantidad: conteo.Finalizada,
      clase: "filtro-finalizada",
    },
    {
      estatus: "Cancelada",
      etiqueta: "Canceladas",
      cantidad: conteo.Cancelada,
      clase: "filtro-cancelada",
    },
  );

  contenedorFiltros.innerHTML = filtros
    .map(
      (filtro) => `
        <button
          class="filtro-card ${filtro.clase} ${filtroEstatus === filtro.estatus ? "activo" : ""}"
          onclick="cambiarFiltro('${filtro.estatus}')"
          type="button"
        >
          <span class="filtro-label">${filtro.etiqueta}</span>
          <span class="filtro-value">${filtro.cantidad}</span>
        </button>
      `,
    )
    .join("");
}

/* =========================================================
   APLICAR FILTROS
========================================================= */
function aplicarFiltros() {
  let actividadesBase = [...actividadesOriginales];

  if (textoBusqueda.trim() !== "") {
    actividadesBase = actividadesBase.filter((act) =>
      String(act.nombre_responsable || "")
        .toLowerCase()
        .includes(textoBusqueda.toLowerCase()),
    );
  }

  if (rolActual === "alumno") {
    actividadesBase = actividadesBase.filter((act) =>
      cumpleFiltroHoras(act.horas_actividad),
    );
  }

  renderizarResumen(actividadesBase);
  renderizarFiltros(actividadesBase);

  let filtradas = [...actividadesBase];

  if (filtroEstatus !== "Todos") {
    filtradas = filtradas.filter((act) => act.estatus === filtroEstatus);
  }

  mostrarActividades(filtradas);
}

/* =========================================================
   CAMBIAR FILTRO DE ESTATUS
========================================================= */
function cambiarFiltro(estatus) {
  filtroEstatus = estatus;
  aplicarFiltros();
}

/* =========================================================
   MOSTRAR ACTIVIDADES EN PANTALLA
========================================================= */
function mostrarActividades(actividades) {
  listaActividades.innerHTML = "";

  if (!actividades.length) {
    sinActividades.style.display = "block";
    return;
  }

  sinActividades.style.display = "none";

  actividades.forEach((act) => {
    const inscritos = Number(act.inscritos || 0);
    const cupo = Number(act.totalAlumnosRequeridos || 0);
    const estatus = act.estatus || "Finalizada";
    const statusClass = obtenerClaseStatus(estatus);

    const horasProyecto = Number(act.horas_actividad || 0);
    const horasCumplidas = Number(act.horas_cumplidas || 0);
    const porcentajeAvance = Number(act.porcentaje_avance || 0);
    const claseBarra = obtenerClaseBarraProgreso(estatus, porcentajeAvance);

    const hayCupo = inscritos < cupo;
    const estaActiva = estatus === "Activa";
    const yaInscrito = Number(act.inscrito) === 1 || act.inscrito === true;

    const claseFila = yaInscrito
      ? "actividad-row actividad-inscrita"
      : "actividad-row";

    let accionesHTML = `
      <button class="btn-tabla btn-ver" onclick="verTareas(${Number(act.idactividad)})">
        Tareas
      </button>
    `;

    if (rolActual === "alumno") {
      let textoBoton = "Inscribirse";
      let claseBoton = "btn-unirme";
      let deshabilitado = "";

      if (yaInscrito) {
        textoBoton = "Inscrito";
        claseBoton = "btn-inscrito";
        deshabilitado = "disabled";
      } else if (!estaActiva) {
        textoBoton = "No disponible";
        claseBoton = "btn-no-disponible";
        deshabilitado = "disabled";
      } else if (!hayCupo) {
        textoBoton = "Cupo lleno";
        claseBoton = "btn-cupo-lleno";
        deshabilitado = "disabled";
      }

      accionesHTML += `
        <button
          class="btn-tabla ${claseBoton}"
          onclick="unirme(${Number(act.idactividad)})"
          ${deshabilitado}
        >
          ${textoBoton}
        </button>
      `;
    }

    if (rolActual === "responsable") {
      accionesHTML += `
        <button class="btn-tabla btn-edit" onclick="editarActividad(${Number(act.idactividad)})">
          Editar
        </button>
        <button class="btn-tabla btn-del" onclick="eliminarActividad(${Number(act.idactividad)})">
          Borrar
        </button>
      `;
    }

    const mostrarProgreso =
      rolActual === "responsable" || rolActual === "director";

    const progresoHTML = mostrarProgreso
      ? `
        <div class="bloque-progreso-proyecto">
          <div class="progreso-proyecto-header">
            <span class="progreso-proyecto-label">
              Avance del proyecto
            </span>
            <span class="progreso-proyecto-valor">
              ${horasCumplidas} / ${horasProyecto} hrs · ${porcentajeAvance}%
            </span>
          </div>

          <div class="barra-progreso-proyecto-bg">
            <div
              class="barra-progreso-proyecto-fill ${claseBarra}"
              style="width: ${porcentajeAvance}%"
            ></div>
          </div>
        </div>
      `
      : "";

    listaActividades.innerHTML += `
      <div class="${claseFila}">
        <div class="actividad-grid">
          <div class="col-proyecto">
            <span class="label-col">Proyecto</span>
            <div class="nombre-proyecto">${escaparHTML(act.nombreActividad || "Sin nombre")}</div>
            <div class="descripcion-proyecto">
              ${escaparHTML(act.descripcion || "Sin descripción")}
            </div>
          </div>

          <div class="col-info">
            <span class="label-col">Responsable</span>
            <div class="valor-col">${escaparHTML(act.nombre_responsable || "N/A")}</div>
          </div>

          <div class="col-info">
            <span class="label-col">Horas</span>
            <div class="valor-col">${horasProyecto} hrs</div>
          </div>

          <div class="col-info">
            <span class="label-col">Cupo</span>
            <div class="valor-col">${inscritos} de ${cupo}</div>
          </div>

          <div class="col-info">
            <span class="label-col">Estatus</span>
            <div class="valor-col">
              <span class="status-pill ${statusClass}">
                ${escaparHTML(estatus)}
              </span>
            </div>
          </div>

          <div class="col-info">
            <span class="label-col">Inicio</span>
            <div class="valor-col">${formatearFecha(act.fecha_alta)}</div>
          </div>

          <div class="col-info">
            <span class="label-col">Término</span>
            <div class="valor-col">${formatearFecha(act.fechaTermino)}</div>
          </div>

          <div class="btn-acciones-tabla">
            ${accionesHTML}
          </div>
        </div>

        ${progresoHTML}
      </div>
    `;
  });
}

/* =========================================================
   ABRIR MODAL PARA NUEVO PROYECTO
========================================================= */
function abrirNuevo() {
  inputId.value = "";
  inputNombre.value = "";
  inputDescripcion.value = "";
  inputHoras.value = "";
  inputAlumnos.value = "";
  inputInicio.value = "";
  inputFin.value = "";

  if (inputEstatus) {
    inputEstatus.value = "Pendiente";
  }

  if (document.getElementById("contenedorEstatus")) {
    document.getElementById("contenedorEstatus").style.display = "none";
  }

  if (tituloModalActividad) {
    tituloModalActividad.textContent = "Nuevo Proyecto";
  }

  if (textoBtnGuardarProyecto) {
    textoBtnGuardarProyecto.textContent = "Guardar Proyecto";
  }

  modal.show();
}

/* =========================================================
   EDITAR ACTIVIDAD
========================================================= */
function editarActividad(idactividad) {
  const act = buscarActividadPorId(idactividad);

  if (!act) {
    alert("No se encontró la actividad a editar.");
    return;
  }

  inputId.value = act.idactividad;
  inputNombre.value = act.nombreActividad || "";
  inputDescripcion.value = act.descripcion || "";
  inputHoras.value = act.horas_actividad || "";
  inputAlumnos.value = act.totalAlumnosRequeridos || "";
  inputInicio.value = fechaInput(act.fecha_alta);
  inputFin.value = fechaInput(act.fechaTermino);

  if (inputEstatus) {
    inputEstatus.value = act.estatus || "Pendiente";
  }

  if (document.getElementById("contenedorEstatus")) {
    document.getElementById("contenedorEstatus").style.display = "block";
  }

  if (tituloModalActividad) {
    tituloModalActividad.textContent = "Editar Proyecto";
  }

  if (textoBtnGuardarProyecto) {
    textoBtnGuardarProyecto.textContent = "Actualizar Proyecto";
  }

  modal.show();
}

/* =========================================================
   GUARDAR ACTIVIDAD
========================================================= */
async function guardarActividad(e) {
  e.preventDefault();

  if (inputFin.value < inputInicio.value) {
    alert("La fecha de término no puede ser menor que la fecha de inicio.");
    return;
  }

  const data = {
    nombreActividad: inputNombre.value.trim(),
    descripcion: inputDescripcion.value.trim(),
    horas_actividad: Number(inputHoras.value),
    fecha_alta: inputInicio.value,
    fechaTermino: inputFin.value,
    totalAlumnosRequeridos: Number(inputAlumnos.value),
    estatus: inputEstatus.value,
  };

  try {
    const id = inputId.value;
    const url = id ? `${API_URL}/${id}` : API_URL;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (res.status === 401) {
      cerrarSesion();
      return;
    }

    const respuesta = await leerJSONSeguro(res);

    if (!res.ok) {
      alert(respuesta.msg || "Error al guardar el proyecto.");
      return;
    }

    modal.hide();
    cargarActividades();
  } catch (error) {
    console.error("Error al guardar actividad:", error);
    alert("Error de conexión con el servidor.");
  }
}

/* =========================================================
   ELIMINAR / CANCELAR ACTIVIDAD
========================================================= */
async function eliminarActividad(idactividad) {
  if (!confirm("¿Seguro que quieres CANCELAR este proyecto?")) {
    return;
  }

  try {
    const res = await fetch(`${API_URL}/${idactividad}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (res.status === 401) {
      cerrarSesion();
      return;
    }

    const respuesta = await leerJSONSeguro(res);

    if (!res.ok) {
      alert(respuesta.msg || "No se pudo cancelar el proyecto.");
      return;
    }

    cargarActividades();
  } catch (error) {
    console.error("Error al cancelar actividad:", error);
    alert("Error de conexión con el servidor.");
  }
}

/* =========================================================
   INSCRIPCIÓN DEL ALUMNO A UNA ACTIVIDAD
========================================================= */
async function unirme(idactividad) {
  if (!confirm("¿Estás seguro de que deseas inscribirte en esta actividad?")) {
    return;
  }

  try {
    const res = await fetch(API_URL_ASIGNACION, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ idactividad }),
    });

    if (res.status === 401) {
      cerrarSesion();
      return;
    }

    const data = await leerJSONSeguro(res);

    if (!res.ok) {
      const msg = String(data.msg || "").toLowerCase();

      if (msg.includes("480") || msg.includes("horas")) {
        alert("⚠️ No puedes unirte: superarías el límite de 480 horas.");
      } else if (msg.includes("llena") || msg.includes("cupo")) {
        alert("❌ Esta actividad ya alcanzó su cupo máximo.");
      } else if (msg.includes("inscrito")) {
        alert("⚠️ Ya te encuentras inscrito en esta actividad.");
      } else {
        alert(data.msg || "Hubo un error al procesar tu inscripción.");
      }

      return;
    }

    alert("✅ ¡Inscripción exitosa! Ahora eres parte de esta actividad.");
    cargarActividades();
  } catch (error) {
    console.error("Error en unirme:", error);
    alert("Error de conexión con el servidor.");
  }
}

/* =========================================================
   VER TAREAS DE UNA ACTIVIDAD
========================================================= */
async function verTareas(idactividad) {
  idActividadActual = idactividad;

  const actividadActual = buscarActividadPorId(idactividad);

  if (!actividadActual) {
    alert("No se encontró la actividad seleccionada.");
    return;
  }

  try {
    nombreActividadModal.textContent = actividadActual.nombreActividad || "";

    const res = await fetch(`${API_TAREAS}/${idactividad}`, {
      headers: getHeaders(),
    });

    if (res.status === 401) {
      cerrarSesion();
      return;
    }

    const data = await leerJSONSeguro(res);

    if (!res.ok) {
      alert(data.msg || "No se pudieron cargar las tareas.");
      return;
    }

    tareasActuales = Array.isArray(data) ? data : [];

    let totalHorasUsadas = 0;
    let html = "";

    tareasActuales.forEach((tarea) => {
      totalHorasUsadas += Number(tarea.horas_Tareas || 0);

      html += `
        <tr>
          <td>${escaparHTML(tarea.nombre_tarea || "")}</td>
          <td>${Number(tarea.horas_Tareas || 0)}</td>
          <td>${formatearFecha(tarea.fechaInicio)}</td>
          <td>${formatearFecha(tarea.fechaFin)}</td>
          <td class="text-center">
            ${
              rolActual === "responsable"
                ? `
                  <button
                    class="btn btn-warning btn-sm"
                    onclick="editarTarea(${Number(tarea.idTareas_Actividad)})"
                    title="Editar tarea"
                  >
                    ✏️
                  </button>
                  <button
                    class="btn btn-danger btn-sm"
                    onclick="eliminarTarea(${Number(tarea.idTareas_Actividad)})"
                    title="Eliminar tarea"
                  >
                    🗑
                  </button>
                `
                : `<span class="text-muted">Solo lectura</span>`
            }
          </td>
        </tr>
      `;
    });

    if (!tareasActuales.length) {
      html = `
        <tr>
          <td colspan="5" class="text-center text-muted">
            No hay tareas registradas para este proyecto.
          </td>
        </tr>
      `;
    }

    tablaTareas.innerHTML = html;

    const totalActividad = Number(actividadActual.horas_actividad || 0);
    const restantes = totalActividad - totalHorasUsadas;

    if (rolActual === "responsable") {
      btnNuevaTarea.style.display = "inline-block";
      btnNuevaTarea.disabled = restantes <= 0;
      btnNuevaTarea.textContent =
        restantes <= 0 ? "Horas completas" : "+ Nueva tarea";
    } else {
      btnNuevaTarea.style.display = "none";
    }

    infoHoras.textContent = `Horas usadas: ${totalHorasUsadas} / ${totalActividad} | Restantes: ${restantes}`;
    infoHoras.className =
      restantes < 0 ? "mt-2 fw-bold text-danger" : "mt-2 fw-bold text-success";

    modalTareas.show();
  } catch (error) {
    console.error("Error al ver tareas:", error);
    alert("Error de conexión con el servidor.");
  }
}

/* =========================================================
   ABRIR FORMULARIO PARA NUEVA TAREA
========================================================= */
function abrirNuevaTarea() {
  if (rolActual !== "responsable") {
    alert("No tienes permisos.");
    return;
  }

  inputTareaId.value = "";
  inputNombreTarea.value = "";
  inputHorasTarea.value = "";
  inputFechaInicioTarea.value = "";
  inputFechaFinTarea.value = "";

  const actividadActual = buscarActividadPorId(idActividadActual);

  if (actividadActual) {
    const fechaProyectoInicio = fechaInput(actividadActual.fecha_alta);
    const fechaProyectoFin = fechaInput(actividadActual.fechaTermino);

    inputFechaInicioTarea.min = fechaProyectoInicio;
    inputFechaInicioTarea.max = fechaProyectoFin;
    inputFechaFinTarea.min = fechaProyectoInicio;
    inputFechaFinTarea.max = fechaProyectoFin;
  }

  modalFormTarea.show();
}

/* =========================================================
   EDITAR TAREA
========================================================= */
function editarTarea(idTarea) {
  const tarea = buscarTareaPorId(idTarea);

  if (!tarea) {
    alert("No se encontró la tarea.");
    return;
  }

  inputTareaId.value = tarea.idTareas_Actividad;
  inputNombreTarea.value = tarea.nombre_tarea || "";
  inputHorasTarea.value = tarea.horas_Tareas || "";
  inputFechaInicioTarea.value = fechaInput(tarea.fechaInicio);
  inputFechaFinTarea.value = fechaInput(tarea.fechaFin);

  const actividadActual = buscarActividadPorId(idActividadActual);

  if (actividadActual) {
    const fechaProyectoInicio = fechaInput(actividadActual.fecha_alta);
    const fechaProyectoFin = fechaInput(actividadActual.fechaTermino);

    inputFechaInicioTarea.min = fechaProyectoInicio;
    inputFechaInicioTarea.max = fechaProyectoFin;
    inputFechaFinTarea.min = fechaProyectoInicio;
    inputFechaFinTarea.max = fechaProyectoFin;
  }

  modalFormTarea.show();
}

/* =========================================================
   GUARDAR TAREA
========================================================= */
async function guardarTarea(e) {
  e.preventDefault();

  if (inputFechaFinTarea.value < inputFechaInicioTarea.value) {
    alert("La fecha de fin no puede ser menor que la fecha de inicio.");
    return;
  }

  const actividadActual = buscarActividadPorId(idActividadActual);

  if (actividadActual) {
    const fechaProyectoInicio = fechaInput(actividadActual.fecha_alta);
    const fechaProyectoFin = fechaInput(actividadActual.fechaTermino);

    if (
      inputFechaInicioTarea.value < fechaProyectoInicio ||
      inputFechaFinTarea.value > fechaProyectoFin
    ) {
      alert(
        `La tarea debe estar dentro del rango del proyecto: ${fechaProyectoInicio} a ${fechaProyectoFin}`,
      );
      return;
    }
  }

  const id = inputTareaId.value;

  const data = {
    idactividad: idActividadActual,
    nombre_tarea: inputNombreTarea.value.trim(),
    horas_Tareas: Number(inputHorasTarea.value),
    fechaInicio: inputFechaInicioTarea.value,
    fechaFin: inputFechaFinTarea.value,
  };

  try {
    const url = id ? `${API_TAREAS}/${id}` : API_TAREAS;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (res.status === 401) {
      cerrarSesion();
      return;
    }

    const respuesta = await leerJSONSeguro(res);

    if (!res.ok) {
      alert(respuesta.msg || "Error al guardar la tarea.");
      return;
    }

    modalFormTarea.hide();
    verTareas(idActividadActual);
  } catch (error) {
    console.error("Error al guardar tarea:", error);
    alert("Error de conexión con el servidor.");
  }
}

/* =========================================================
   ELIMINAR TAREA
========================================================= */
async function eliminarTarea(idTarea) {
  if (!confirm("¿Seguro que deseas eliminar esta tarea?")) {
    return;
  }

  try {
    const res = await fetch(`${API_TAREAS}/${idTarea}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (res.status === 401) {
      cerrarSesion();
      return;
    }

    const respuesta = await leerJSONSeguro(res);

    if (!res.ok) {
      alert(respuesta.msg || "No se pudo eliminar la tarea.");
      return;
    }

    verTareas(idActividadActual);
  } catch (error) {
    console.error("Error al eliminar tarea:", error);
    alert("Error de conexión con el servidor.");
  }
}

/* =========================================================
   EXPONER FUNCIONES GLOBALES
========================================================= */
window.abrirNuevo = abrirNuevo;
window.cambiarFiltro = cambiarFiltro;
window.verTareas = verTareas;
window.abrirNuevaTarea = abrirNuevaTarea;
window.editarActividad = editarActividad;
window.eliminarActividad = eliminarActividad;
window.editarTarea = editarTarea;
window.eliminarTarea = eliminarTarea;
window.unirme = unirme;
