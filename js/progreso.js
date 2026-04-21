// =========================================================
// CONFIGURACIÓN GENERAL
// =========================================================

// Esta función construye los headers comunes para todas las peticiones protegidas.
// Así evitamos repetir el token manualmente en cada fetch.
function getHeaders() {
  return {
    "Content-Type": "application/json", // indica que el body viajará en formato JSON
    Authorization: `Bearer ${localStorage.getItem("token")}`, // envía el token JWT guardado en localStorage
  };
}

// =========================================================
// UTILIDADES
// =========================================================

// Escapa caracteres especiales para evitar problemas al insertar
// texto dinámico dentro de innerHTML.
function escaparHTML(valor) {
  return String(valor ?? "") // convierte a string, y si viene null/undefined usa cadena vacía
    .replaceAll("&", "&amp;") // escapa &
    .replaceAll("<", "&lt;") // escapa <
    .replaceAll(">", "&gt;") // escapa >
    .replaceAll('"', "&quot;") // escapa comillas dobles
    .replaceAll("'", "&#39;"); // escapa comillas simples
}

// Convierte fechas como:
// - 2026-05-12
// - 2026-05-12T00:00:00.000Z
// al formato visual dd/mm/yyyy
function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha"; // si no hay fecha, devuelve texto por defecto

  const soloFecha = String(fecha).split("T")[0]; // toma solo la parte YYYY-MM-DD
  const partes = soloFecha.split("-"); // separa año, mes y día

  if (partes.length !== 3) return soloFecha; // si no tiene el formato esperado, devuelve la fecha tal cual

  const [anio, mes, dia] = partes; // separa año, mes y día
  return `${dia}/${mes}/${anio}`; // regresa la fecha como dd/mm/yyyy
}

// =========================================================
// VARIABLES GLOBALES
// =========================================================

// Guarda el filtro actual de la vista: Todos, Concluidos o Pendientes
let filtroProgreso = "Todos";

// Guarda todas las actividades que llegan del backend
// para poder filtrarlas sin volver a consultar al servidor.
let actividadesOriginalesProgreso = [];

// Guarda el resumen general de horas del alumno.
let resumenProgreso = {
  horasLiberadas: 0, // horas ya ganadas/liberadas
  horasFaltantes: 480, // horas faltantes para completar 480
};

// Guarda el nombre de la actividad actual para mostrarlo en el modal de tareas.
let nombreActividadActualModal = "";

// =========================================================
// INICIO
// =========================================================

// Cuando carga la página:
// 1. consulta el progreso del alumno
// 2. marca visualmente el botón de filtro actual
document.addEventListener("DOMContentLoaded", () => {
  cargarProgreso(); // obtiene datos del backend
  actualizarBotonesFiltroProgreso(); // deja activo el filtro visual
});

// =========================================================
// LIMPIEZA GLOBAL DE MODALES
// - Evita que el fondo oscuro se quede pegado
// =========================================================

// Cuando cualquier modal de Bootstrap se cierra,
// elimina manualmente el backdrop y limpia estilos del body.
// Esto evita que la pantalla quede bloqueada por un fondo oscuro.
document.addEventListener("hidden.bs.modal", function () {
  document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove()); // elimina fondos oscuros sobrantes
  document.body.classList.remove("modal-open"); // quita clase de Bootstrap que bloquea scroll
  document.body.style.paddingRight = "0"; // limpia padding agregado por Bootstrap
  document.body.style.overflow = "auto"; // vuelve a permitir scroll
});

// =========================================================
// CARGAR PROGRESO DEL ALUMNO
// =========================================================

// Consulta el backend y obtiene:
// - horas liberadas
// - horas faltantes
// - actividades inscritas
async function cargarProgreso() {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/progreso", {
      headers: getHeaders(), // manda token JWT
    });

    const data = await res.json(); // convierte la respuesta a JSON

    if (!res.ok) {
      // si el backend respondió error, lo muestra en consola
      console.error("Error al cargar progreso:", data.msg);
      return;
    }

    const horasEl = document.getElementById("horasLiberadas"); // elemento donde se muestra el total de horas liberadas
    const faltantesEl = document.getElementById("horasFaltantes"); // elemento donde se muestran horas faltantes

    if (!horasEl || !faltantesEl) return; // si faltan elementos del DOM, se detiene

    resumenProgreso.horasLiberadas = Number(data.horasLiberadas) || 0; // convierte y guarda horas liberadas
    resumenProgreso.horasFaltantes = Number(data.horasFaltantes) || 480; // convierte y guarda horas faltantes

    horasEl.innerText = resumenProgreso.horasLiberadas; // pinta horas liberadas
    faltantesEl.innerText = resumenProgreso.horasFaltantes; // pinta horas faltantes

    actividadesOriginalesProgreso = Array.isArray(data.actividades)
      ? data.actividades // si viene arreglo, lo guarda
      : []; // si no, deja arreglo vacío

    aplicarFiltroProgreso(); // después de cargar, aplica el filtro actual y renderiza
  } catch (error) {
    console.error("Error de conexión:", error); // error de red o del fetch
  }
}

// =========================================================
// DETERMINAR SI UN PROYECTO ESTÁ CONCLUIDO
// =========================================================

// Un proyecto se considera concluido cuando
// todas sus tareas están marcadas como cumplidas.
function esProyectoConcluido(act) {
  const total = Number(act.total_tareas) || 0; // total de tareas de la actividad
  const completadas = Number(act.tareas_completadas) || 0; // tareas marcadas como cumplidas

  return total > 0 && completadas === total; // solo concluye si sí hay tareas y todas están completas
}

// =========================================================
// CAMBIAR FILTRO DE PROGRESO
// =========================================================

// Cambia el filtro actual y vuelve a renderizar la vista.
function cambiarFiltroProgreso(tipo) {
  filtroProgreso = tipo; // actualiza filtro global
  actualizarBotonesFiltroProgreso(); // actualiza el botón activo visualmente
  aplicarFiltroProgreso(); // vuelve a filtrar y dibujar
}

// =========================================================
// ACTUALIZAR BOTONES DE FILTRO
// =========================================================

// Recorre los botones y deja activo solo el filtro actual.
function actualizarBotonesFiltroProgreso() {
  const botones = document.querySelectorAll(".filtro-progreso"); // obtiene todos los botones de filtro

  botones.forEach((btn) => {
    btn.classList.remove("active"); // primero les quita la clase a todos

    const texto = btn.textContent.toLowerCase(); // toma el texto visible del botón en minúsculas

    if (filtroProgreso === "Todos" && texto.includes("todos")) {
      btn.classList.add("active"); // activa el botón de Todos
    }

    if (filtroProgreso === "Concluidos" && texto.includes("concluidos")) {
      btn.classList.add("active"); // activa el botón de Concluidos
    }

    if (filtroProgreso === "Pendientes" && texto.includes("pendientes")) {
      btn.classList.add("active"); // activa el botón de Pendientes
    }
  });
}

// =========================================================
// APLICAR FILTRO
// =========================================================

// Toma todas las actividades y aplica el filtro actual.
function aplicarFiltroProgreso() {
  let filtradas = [...actividadesOriginalesProgreso]; // crea copia para no modificar el arreglo original

  if (filtroProgreso === "Concluidos") {
    filtradas = filtradas.filter((act) => esProyectoConcluido(act)); // deja solo actividades completas
  } else if (filtroProgreso === "Pendientes") {
    filtradas = filtradas.filter((act) => !esProyectoConcluido(act)); // deja solo actividades no completas
  }

  renderizarProgreso(filtradas); // renderiza el resultado final
}

// =========================================================
// RENDERIZAR PROGRESO
// =========================================================

// Dibuja las tarjetas de actividades inscritas.
// Muestra:
// - fecha de inicio
// - fecha de término
// - estatus
// - progreso de tareas
// - botones para ver tareas y responsable
function renderizarProgreso(actividades) {
  const contenedor = document.getElementById("listaProgreso"); // contenedor principal donde se insertan las tarjetas
  if (!contenedor) return; // si no existe, se detiene

  contenedor.innerHTML = ""; // limpia tarjetas anteriores

  if (!actividades || actividades.length === 0) {
    // si no hay actividades para mostrar
    contenedor.innerHTML = `
      <div class="col-12 text-center py-5">
        <p class="text-muted">No hay proyectos para este filtro.</p>
      </div>
    `;
    return;
  }

  actividades.forEach((act) => {
    const totalTareas = Number(act.total_tareas) || 0; // total de tareas de la actividad
    const tareasCompletadas = Number(act.tareas_completadas) || 0; // tareas cumplidas
    const horasGanadas = Number(act.horas_ganadas) || 0; // horas obtenidas por tareas cumplidas
    const horasActividad = Number(act.horas_actividad) || 0; // horas totales de la actividad

    const porcentaje =
      totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0; // calcula porcentaje de avance

    let badgeClase = "bg-secondary"; // clase por defecto del badge
    if (act.estado_actividad === "Activa") badgeClase = "bg-success"; // verde si está activa
    if (act.estado_actividad === "Finalizada") badgeClase = "bg-primary"; // azul si está finalizada
    if (act.estado_actividad === "Pendiente")
      badgeClase = "bg-warning text-dark"; // amarillo si está pendiente
    if (act.estado_actividad === "Cancelada") badgeClase = "bg-danger"; // rojo si está cancelada

    const estatusAlumnoVista = esProyectoConcluido(act)
      ? "Concluido" // si todas las tareas están cumplidas
      : "Pendiente"; // si aún faltan tareas

    const fechaInicio = formatearFecha(act.fecha_alta); // fecha de inicio formateada
    const fechaTermino = formatearFecha(act.fechaTermino); // fecha de término formateada

    contenedor.innerHTML += `
      <div class="col-md-6 mb-3">
        <div class="card h-100 border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="card-title text-primary mb-0">
                ${escaparHTML(act.nombreActividad)}
              </h5>
              <span class="badge ${badgeClase}">
                ${escaparHTML(act.estado_actividad)}
              </span>
            </div>

            <p class="text-muted small mb-3">
              ${escaparHTML(act.descripcion || "Sin descripción")}
            </p>

            <!-- Fechas de la actividad -->
            <div class="row small mb-3">
              <div class="col-6">
                <strong>Inicio:</strong><br>
                ${escaparHTML(fechaInicio)}
              </div>

              <div class="col-6">
                <strong>Término:</strong><br>
                ${escaparHTML(fechaTermino)}
              </div>
            </div>

            <hr>

            <div class="row small mb-3">
              <div class="col-6">
                <strong>Estatus Alumno:</strong><br>
                ${escaparHTML(estatusAlumnoVista)}
              </div>

              <div class="col-6">
                <strong>Horas Ganadas:</strong><br>
                ${horasGanadas} / ${horasActividad}
              </div>
            </div>

            <div class="mb-3">
              <div class="d-flex justify-content-between mb-1 small">
                <span>Progreso de tareas</span>
                <span>${porcentaje}%</span>
              </div>

              <div class="progress" style="height: 10px;">
                <div
                  class="progress-bar progress-bar-striped progress-bar-animated"
                  role="progressbar"
                  style="width: ${porcentaje}%"
                  aria-valuenow="${porcentaje}"
                  aria-valuemin="0"
                  aria-valuemax="100"
                ></div>
              </div>
            </div>

            <div class="d-grid gap-2 d-md-block">
              <button
                class="btn btn-outline-info btn-sm"
                data-bs-toggle="modal"
                data-bs-target="#modalTareas"
                onclick='verTareasAlumno(${act.idactividad}, ${JSON.stringify(
                  act.nombreActividad || "",
                )})'
              >
                📋 Ver tareas
              </button>

              <button
                class="btn btn-outline-primary btn-sm"
                data-bs-toggle="modal"
                data-bs-target="#modalResponsable"
                onclick="verResponsable(${act.idactividad})"
              >
                👤 Responsable
              </button>
            </div>
          </div>
        </div>
      </div>
    `; // agrega una tarjeta por actividad
  });
}

// =========================================================
// LIMPIEZA MANUAL DE MODALES
// =========================================================

// Elimina manualmente restos del modal si Bootstrap deja el fondo atorado.
function forzarLimpiezaModal() {
  const backdrops = document.querySelectorAll(".modal-backdrop"); // busca todos los fondos oscuros
  backdrops.forEach((b) => b.remove()); // los elimina uno por uno

  document.body.classList.remove("modal-open"); // quita clase que bloquea el scroll
  document.body.style.overflow = "auto"; // vuelve a habilitar scroll
  document.body.style.paddingRight = "0"; // limpia padding extra
}

// =========================================================
// VER TAREAS DE UNA ACTIVIDAD
// - Obtiene las tareas del alumno para una actividad
// - Muestra el nombre del proyecto
// - Muestra fecha de cada tarea
// =========================================================

async function verTareasAlumno(idactividad, nombreActividad = "") {
  nombreActividadActualModal = nombreActividad || ""; // guarda el nombre de la actividad para usarlo en el modal

  const subtitulo = document.getElementById("modalTareasSubtitulo"); // subtítulo donde se muestra el nombre del proyecto
  const listaChecklistAlumno = document.getElementById("listaChecklistAlumno"); // contenedor donde se insertan las tareas

  if (subtitulo) {
    subtitulo.textContent = nombreActividadActualModal
      ? `Proyecto: ${nombreActividadActualModal}` // si hay nombre, lo muestra
      : ""; // si no, deja vacío
  }

  if (listaChecklistAlumno) {
    listaChecklistAlumno.innerHTML = `
      <div class="list-group-item text-center text-muted py-3">
        Cargando tareas...
      </div>
    `; // mensaje temporal mientras consulta al backend
  }

  forzarLimpiezaModal(); // limpia restos visuales de modales anteriores

  try {
    const res = await fetch(
      `http://127.0.0.1:3000/api/progreso/tareas/${idactividad}`, // endpoint para obtener tareas de esa actividad
      {
        headers: getHeaders(), // manda token JWT
      },
    );

    const data = await res.json(); // convierte respuesta a JSON

    if (!res.ok) {
      console.error(data.msg || "Error al obtener tareas"); // muestra error en consola
      if (listaChecklistAlumno) {
        listaChecklistAlumno.innerHTML = `
          <div class="list-group-item text-center text-danger py-3">
            No se pudieron cargar las tareas.
          </div>
        `; // muestra mensaje de error dentro del modal
      }
      return;
    }

    const nombreProyecto =
      data.nombreActividad || nombreActividadActualModal || ""; // toma el nombre que venga del backend o usa el que ya estaba guardado
    const tareas = Array.isArray(data.tareas) ? data.tareas : []; // asegura que tareas sea arreglo

    if (subtitulo) {
      subtitulo.textContent = nombreProyecto
        ? `Proyecto: ${nombreProyecto}` // actualiza subtítulo con el nombre final
        : "";
    }

    if (!listaChecklistAlumno) return; // si no existe el contenedor, sale

    listaChecklistAlumno.innerHTML = ""; // limpia contenido anterior

    if (tareas.length === 0) {
      // si la actividad no tiene tareas
      listaChecklistAlumno.innerHTML = `
        <div class="list-group-item text-center text-muted py-3">
          No hay tareas registradas para esta actividad.
        </div>
      `;
      return;
    }

    tareas.forEach((t) => {
      const cumplida = t.estatus === "Cumplida"; // true si la tarea está marcada como cumplida
      const fechaInicio = formatearFecha(t.fechaInicio); // formatea fecha inicio
      const fechaFin = formatearFecha(t.fechaFin); // formatea fecha fin

      listaChecklistAlumno.innerHTML += `
        <div class="list-group-item checklist-item d-flex justify-content-between align-items-center py-3">
          <div>
            <h6 class="mb-1 fw-bold">${escaparHTML(t.nombre_tarea)}</h6>
            <small class="text-muted d-block">
              ${Number(t.horas_Tareas) || 0} horas asignadas
          <small class="text-muted d-block">
              Inicio: ${escaparHTML(fechaInicio)}
          </small>
          <small class="text-muted d-block">
              Fin: ${escaparHTML(fechaFin)}
          </small>
          </div>

          <span class="estado-tarea-pill ${
            cumplida ? "estado-tarea-cumplida" : "estado-tarea-pendiente"
          }">
            ${cumplida ? "✓ Cumplida" : "Pendiente"}
          </span>
        </div>
      `; // agrega cada tarea con sus horas, fechas y estatus visual
    });
  } catch (error) {
    console.error(error); // error de conexión o del fetch

    if (listaChecklistAlumno) {
      listaChecklistAlumno.innerHTML = `
        <div class="list-group-item text-center text-danger py-3">
          Error de conexión al cargar las tareas.
        </div>
      `; // muestra mensaje de error si falló la conexión
    }
  }
}

// =========================================================
// VER RESPONSABLE DE UNA ACTIVIDAD
// =========================================================

// Consulta los datos del responsable de la actividad.
async function verResponsable(idActividad) {
  forzarLimpiezaModal(); // limpia restos visuales del modal anterior

  try {
    const res = await fetch(
      `http://127.0.0.1:3000/responsable/${idActividad}`, // endpoint que devuelve los datos del responsable
      {
        headers: getHeaders(), // manda token JWT
      },
    );

    const data = await res.json(); // convierte respuesta a JSON

    if (!res.ok) return; // si el backend respondió error, no continúa

    const resNombre = document.getElementById("resNombre"); // elemento donde va el nombre del responsable
    const resTelefono = document.getElementById("resTelefono"); // elemento donde va el teléfono
    const resUbicacion = document.getElementById("resUbicacion"); // elemento donde va la ubicación

    if (resNombre) resNombre.innerText = data.nombre || "No asignado"; // pinta nombre o texto por defecto
    if (resTelefono) resTelefono.innerText = data.telefono || "N/A"; // pinta teléfono o N/A
    if (resUbicacion) resUbicacion.innerText = data.ubicacion || "N/A"; // pinta ubicación o N/A
  } catch (error) {
    console.error(error); // muestra error técnico en consola
  }
}

// =========================================================
// FUNCIONES GLOBALES
// =========================================================

// Deja estas funciones disponibles globalmente para que
// puedan ser llamadas desde botones con onclick en el HTML.
window.cambiarFiltroProgreso = cambiarFiltroProgreso; // permite cambiar filtro desde la interfaz
window.verTareasAlumno = verTareasAlumno; // permite abrir modal de tareas desde el botón
window.verResponsable = verResponsable; // permite abrir modal del responsable desde el botón