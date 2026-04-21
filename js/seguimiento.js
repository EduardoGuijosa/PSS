// =========================================================
// VARIABLES DE LAS APIs
// =========================================================
const API_ACTIVIDADES = "http://127.0.0.1:3000/api/actividad"; // endpoint para obtener las actividades del responsable
const API_ALUMNOS = "http://127.0.0.1:3000/api/seguimiento/alumnos"; // endpoint para obtener alumnos inscritos por actividad
const API_TAREAS = "http://127.0.0.1:3000/api/seguimiento/tareas-alumno"; // endpoint para obtener tareas de un alumno según su asignación
const API_TAREAMARCAR = "http://127.0.0.1:3000/api/seguimiento/marcar-tarea"; // endpoint para marcar tarea como cumplida o pendiente

// =========================================================
// VARIABLES GLOBALES
// =========================================================
let idActividadActual = null; // guarda el id de la actividad que se está gestionando actualmente
let actividadesOriginales = []; // guarda todas las actividades cargadas desde el backend
let textoBusquedaProyecto = ""; // guarda el texto actual del buscador de proyectos
let nombreProyectoActual = ""; // guarda el nombre del proyecto actual para mostrarlo en los modales
let nombreAlumnoActual = ""; // guarda el nombre del alumno actual para mostrarlo en el modal de tareas

// =========================================================
// REFERENCIAS AL DOM
// =========================================================
const listaActividades = document.getElementById("listaActividadesResponsable"); // tbody o contenedor donde se muestran las actividades
const tablaAlumnos = document.getElementById("tablaAlumnosInscritos"); // tbody o contenedor donde se muestran los alumnos inscritos
const contenedorChecklist = document.getElementById("listaChecklistTareas"); // contenedor donde se renderizan las tareas del alumno
const inputBuscarProyecto = document.getElementById("buscarProyecto"); // input para buscar proyectos por nombre
const btnLimpiarFiltroProyecto = document.getElementById(
  "btnLimpiarFiltroProyecto", // botón para limpiar el filtro de búsqueda
);
const tituloModalAlumnos = document.getElementById("tituloModalAlumnos"); // título del modal de alumnos inscritos
const subtituloModalAlumnos = document.getElementById("subtituloModalAlumnos"); // subtítulo del modal de alumnos
const tituloModalChecklist = document.getElementById("tituloModalChecklist"); // título del modal de checklist de tareas
const subtituloModalChecklist = document.getElementById(
  "subtituloModalChecklist", // subtítulo del modal de checklist
);

// =========================================================
// REFERENCIAS MODAL INFO
// =========================================================
const infoAlumnoFoto = document.getElementById("infoAlumnoFoto"); // imagen del alumno en el modal de información
const infoAlumnoNombre = document.getElementById("infoAlumnoNombre"); // campo nombre en el modal de información
const infoAlumnoMatricula = document.getElementById("infoAlumnoMatricula"); // campo matrícula en el modal de información
const infoAlumnoGrupo = document.getElementById("infoAlumnoGrupo"); // campo grupo en el modal de información
const infoAlumnoTutor = document.getElementById("infoAlumnoTutor"); // campo tutor en el modal de información
const infoAlumnoTelefono = document.getElementById("infoAlumnoTelefono"); // campo teléfono en el modal de información
const infoAlumnoCorreo = document.getElementById("infoAlumnoCorreo"); // campo correo en el modal de información

// =========================================================
// MODALES
// =========================================================
const modalAlumnos = new bootstrap.Modal(
  document.getElementById("modalAlumnos"), // crea instancia Bootstrap del modal de alumnos
);

const modalInfoAlumno = new bootstrap.Modal(
  document.getElementById("modalInfoAlumno"), // crea instancia Bootstrap del modal de información del alumno
);

const modalTareas = new bootstrap.Modal(
  document.getElementById("modalTareasAlumno"), // crea instancia Bootstrap del modal de tareas
);

// =========================================================
// HEADERS CON TOKEN
// =========================================================
function getHeaders() {
  return {
    "Content-Type": "application/json", // indica que el body viajará en JSON
    Authorization: `Bearer ${localStorage.getItem("token")}`, // agrega el token JWT para autenticar la petición
  };
}

// =========================================================
// UTILIDADES
// =========================================================
function escaparHTML(valor) {
  return String(valor ?? "") // convierte el valor a texto, y si viene null/undefined usa cadena vacía
    .replaceAll("&", "&amp;") // escapa &
    .replaceAll("<", "&lt;") // escapa <
    .replaceAll(">", "&gt;") // escapa >
    .replaceAll('"', "&quot;") // escapa comillas dobles
    .replaceAll("'", "&#39;"); // escapa comillas simples
}

function buscarActividadPorId(idactividad) {
  return actividadesOriginales.find(
    (act) => Number(act.idactividad) === Number(idactividad), // busca la actividad por id dentro del arreglo original
  );
}

function obtenerFotoAlumno(foto) {
  return foto && String(foto).trim() !== "" ? foto : "/img/default-user.png"; // si el alumno tiene foto la usa; si no, usa la imagen por defecto
}

// =========================================================
// RENDERIZAR PROYECTOS EN LA TABLA
// =========================================================
function renderActividades(actividades) {
  if (!listaActividades) return; // si no existe el contenedor, no hace nada

  listaActividades.innerHTML = ""; // limpia el contenido actual antes de volver a pintar

  if (!actividades || actividades.length === 0) {
    // si no hay actividades para mostrar
    listaActividades.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-muted">
          No se encontraron proyectos con ese filtro.
        </td>
      </tr>
    `; // muestra mensaje en la tabla
    return;
  }

  actividades.forEach((act) => {
    const descripcion = act.descripcion
      ? act.descripcion.length > 100
        ? act.descripcion.substring(0, 100) + "..." // si la descripción es muy larga, la recorta
        : act.descripcion // si es corta, la deja completa
      : "Sin descripción detallada."; // texto por defecto si no hay descripción

    listaActividades.innerHTML += `
      <tr>
        <td>
          <div class="fw-bold text-primary text-uppercase">
            ${escaparHTML(act.nombreActividad)}
          </div>
        </td>

        <td class="text-muted">
          ${escaparHTML(descripcion)}
        </td>

        <td class="text-center fw-bold">
          ${act.inscritos || 0}
        </td>

        <td class="text-center">
          ${act.totalAlumnosRequeridos || 0}
        </td>

        <td class="text-center">
          <button
            class="btn btn-outline-primary btn-sm fw-bold"
            onclick="verAlumnos(${act.idactividad})"
          >
            Gestionar Alumnos
          </button>
        </td>
      </tr>
    `; // agrega una fila por cada actividad con botón para gestionar alumnos
  });
}

// =========================================================
// APLICAR FILTRO POR NOMBRE DEL PROYECTO
// =========================================================
function aplicarFiltroProyecto() {
  let filtradas = [...actividadesOriginales]; // crea copia para no alterar el arreglo original

  if (textoBusquedaProyecto.trim() !== "") {
    // si el usuario escribió algo en el buscador
    filtradas = filtradas.filter(
      (act) =>
        (act.nombreActividad || "")
          .toLowerCase()
          .includes(textoBusquedaProyecto.toLowerCase()), // deja solo actividades cuyo nombre coincida con la búsqueda
    );
  }

  renderActividades(filtradas); // renderiza la tabla con el resultado filtrado
}

// =========================================================
// LIMPIAR FILTRO
// =========================================================
function limpiarFiltroProyecto() {
  textoBusquedaProyecto = ""; // limpia el texto guardado del buscador

  if (inputBuscarProyecto) {
    inputBuscarProyecto.value = ""; // limpia visualmente el input
  }

  renderActividades(actividadesOriginales); // vuelve a mostrar todas las actividades
}

// =========================================================
// CARGAR ACTIVIDADES DEL RESPONSABLE
// =========================================================
async function cargarMisActividades() {
  try {
    const res = await fetch(API_ACTIVIDADES, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`, // manda el token JWT
      },
    });

    if (!res.ok) {
      // si el servidor respondió error
      const textoError = await res.text(); // lee la respuesta como texto para depurar
      console.error("Error del servidor:", textoError); // muestra detalle en consola
      throw new Error("Respuesta no válida"); // fuerza el catch
    }

    const actividades = await res.json(); // convierte la respuesta a JSON
    actividadesOriginales = Array.isArray(actividades) ? actividades : []; // guarda las actividades si la respuesta es un arreglo
    aplicarFiltroProyecto(); // aplica filtro actual y renderiza
  } catch (error) {
    console.error("Error al cargar actividades:", error); // muestra error en consola

    if (listaActividades) {
      listaActividades.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-danger">
            Error al conectar con el servidor.
          </td>
        </tr>
      `; // muestra mensaje de error dentro de la tabla
    }
  }
}

// =========================================================
// ABRIR MODAL DE INFO DEL ALUMNO
// =========================================================
function verInfoAlumno(alumno) {
  if (!alumno) return; // si no viene alumno, no hace nada

  if (infoAlumnoFoto) {
    infoAlumnoFoto.src = obtenerFotoAlumno(alumno.foto_perfil); // coloca la foto del alumno o la de default
  }

  if (infoAlumnoNombre) {
    infoAlumnoNombre.value = alumno.nombre_alumno || ""; // llena nombre
  }

  if (infoAlumnoMatricula) {
    infoAlumnoMatricula.value = alumno.matricula || ""; // llena matrícula
  }

  if (infoAlumnoGrupo) {
    infoAlumnoGrupo.value = alumno.grupo || "Sin grupo"; // llena grupo o texto por defecto
  }

  if (infoAlumnoTutor) {
    infoAlumnoTutor.value = alumno.nombre_tutor || "Sin tutor asignado"; // llena nombre del tutor o texto por defecto
  }

  if (infoAlumnoTelefono) {
    infoAlumnoTelefono.value = alumno.telefono || "Sin teléfono"; // llena teléfono o texto por defecto
  }

  if (infoAlumnoCorreo) {
    infoAlumnoCorreo.value = alumno.email || "Sin correo"; // llena correo o texto por defecto
  }

  modalInfoAlumno.show(); // abre el modal de información
}

// =========================================================
// VER ALUMNOS INSCRITOS EN UNA ACTIVIDAD
// =========================================================
async function verAlumnos(idactividad) {
  if (idactividad) {
    idActividadActual = idactividad; // si llega un id, lo guarda como actividad actual
  }

  const actividadActual = buscarActividadPorId(idActividadActual); // busca la actividad completa dentro del arreglo original
  nombreProyectoActual = actividadActual?.nombreActividad || ""; // guarda el nombre del proyecto actual

  if (tituloModalAlumnos) {
    tituloModalAlumnos.textContent = `Alumnos inscritos en el proyecto: ${nombreProyectoActual}`; // actualiza título del modal
  }

  if (subtituloModalAlumnos) {
    subtituloModalAlumnos.textContent =
      "Consulta el progreso real de tareas de cada alumno inscrito."; // coloca subtítulo fijo
  }

  try {
    const res = await fetch(`${API_ALUMNOS}/${idActividadActual}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`, // manda el token
      },
    });

    const alumnos = await res.json(); // convierte respuesta a JSON
    tablaAlumnos.innerHTML = ""; // limpia el contenido actual de la tabla

    if (!alumnos || alumnos.length === 0) {
      // si no hay alumnos inscritos
      tablaAlumnos.innerHTML = `
        <tr>
          <td colspan="3" class="text-center p-4">
            No hay alumnos inscritos en esta actividad.
          </td>
        </tr>
      `;
      modalAlumnos.show(); // abre el modal de todos modos para mostrar el mensaje
      return;
    }

    alumnos.forEach((alum) => {
      const progreso =
        alum.total_tareas > 0
          ? Math.round((alum.tareas_listas / alum.total_tareas) * 100) // calcula porcentaje real de tareas cumplidas
          : 0; // si no tiene tareas, deja 0

      const alumnoSeguro = encodeURIComponent(JSON.stringify(alum)); // serializa y codifica el objeto alumno para enviarlo en onclick sin romper el HTML

      tablaAlumnos.innerHTML += `
        <tr class="align-middle">
          <td class="ps-3">
            <div style="display:flex; align-items:center; gap:12px;">
              <img
                src="${obtenerFotoAlumno(alum.foto_perfil)}"
                alt="Foto de ${escaparHTML(alum.nombre_alumno)}"
                style="width:48px; height:48px; object-fit:cover; border-radius:50%; border:2px solid #d9d9d9;"
              />

              <div>
                <div class="fw-bold text-dark">${escaparHTML(alum.nombre_alumno)}</div>
                <div class="small text-muted">${escaparHTML(alum.matricula)}</div>
              </div>
            </div>
          </td>

          <td style="width: 40%;">
            <div class="d-flex align-items-center">
              <div class="progress flex-grow-1" style="height: 10px; border-radius: 5px;">
                <div
                  class="progress-bar ${progreso === 100 ? "bg-success" : "bg-primary"}"
                  style="width: ${progreso}%"
                ></div>
              </div>
              <span class="ms-3 small fw-bold text-dark">${progreso}%</span>
            </div>

            <div class="text-muted" style="font-size: 0.75rem;">
              ${alum.tareas_listas} de ${alum.total_tareas} completadas
            </div>
          </td>

          <td class="text-center pe-3">
            <div class="d-flex justify-content-center gap-2 flex-wrap">
              <button
                class="btn btn-outline-info btn-sm fw-bold px-3"
                onclick="abrirInfoAlumnoDesdeJSON('${alumnoSeguro}')"
              >
                Info
              </button>

              <button
                class="btn btn-outline-primary btn-sm fw-bold px-3"
                onclick="gestionarTareas(${alum.idasignacion_actividad}, '${escaparHTML(alum.nombre_alumno)}')"
              >
                Evaluar
              </button>
            </div>
          </td>
        </tr>
      `; // agrega fila del alumno con foto, avance, botón info y botón evaluar
    });

    modalAlumnos.show(); // abre el modal con la tabla llena
  } catch (error) {
    console.error("Error al obtener alumnos:", error); // muestra error técnico en consola
  }
}

// =========================================================
// ABRIR INFO DESDE JSON SERIALIZADO
// =========================================================
function abrirInfoAlumnoDesdeJSON(alumnoSerializado) {
  try {
    const alumno = JSON.parse(decodeURIComponent(alumnoSerializado)); // decodifica y convierte el string otra vez a objeto
    verInfoAlumno(alumno); // abre el modal con esos datos
  } catch (error) {
    console.error("Error al abrir info del alumno:", error); // muestra error si el JSON llega mal
  }
}

// =========================================================
// OBTENER TAREAS DEL ALUMNO
// =========================================================
async function gestionarTareas(idasignacion, nombreAlumno = "") {
  nombreAlumnoActual = nombreAlumno || ""; // guarda el nombre del alumno actual

  if (tituloModalChecklist) {
    tituloModalChecklist.textContent = "Checklist de Tareas"; // actualiza título del modal
  }

  if (subtituloModalChecklist) {
    if (nombreAlumnoActual && nombreProyectoActual) {
      subtituloModalChecklist.textContent = `Alumno: ${nombreAlumnoActual} | Proyecto: ${nombreProyectoActual}`; // muestra alumno y proyecto si ambos existen
    } else if (nombreProyectoActual) {
      subtituloModalChecklist.textContent = `Proyecto: ${nombreProyectoActual}`; // si solo existe proyecto, muestra eso
    } else {
      subtituloModalChecklist.textContent = ""; // si no hay datos, lo deja vacío
    }
  }

  try {
    const res = await fetch(`${API_TAREAS}/${idasignacion}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`, // manda token JWT
      },
    });

    const tareas = await res.json(); // convierte respuesta a JSON
    contenedorChecklist.innerHTML = ""; // limpia tareas anteriores

    if (!tareas || tareas.length === 0) {
      // si el alumno no tiene tareas
      contenedorChecklist.innerHTML = `
        <div class="list-group-item text-center text-muted py-3">
          No hay tareas registradas para este alumno.
        </div>
      `;
      modalTareas.show(); // abre el modal mostrando el mensaje
      return;
    }

    tareas.forEach((t) => {
      const esCumplida = t.estatus === "Cumplida"; // revisa si la tarea ya está marcada como cumplida

      contenedorChecklist.innerHTML += `
        <div class="list-group-item checklist-item d-flex justify-content-between align-items-center py-3">
          <div>
            <h6 class="mb-1 fw-bold">${escaparHTML(t.nombre_tarea)}</h6>
            <small class="text-muted">${t.horas_Tareas} horas asignadas</small>
          </div>

          <button
            class="btn btn-cumplida ${
              esCumplida ? "btn-cumplida-activa" : "btn-cumplida-pendiente"
            }"
            onclick="cambiarEstatusYRefrescar(${t.idCumplimientoTarea}, '${
              esCumplida ? "Pendiente" : "Cumplida"
            }', ${idasignacion}, '${escaparHTML(nombreAlumnoActual)}')"
          >
            ${esCumplida ? "✓ Cumplida" : "Cumplida"}
          </button>
        </div>
      `; // agrega cada tarea con su botón para cambiar estatus
    });

    modalTareas.show(); // abre el modal de checklist
  } catch (error) {
    console.error("Error al obtener tareas:", error); // muestra error en consola
  }
}

// =========================================================
// CAMBIAR ESTATUS DE TAREA Y REFRESCAR
// =========================================================
async function cambiarEstatusYRefrescar(
  idCumplimiento,
  nuevoEstatus,
  idasignacion,
  nombreAlumno = "",
) {
  try {
    const res = await fetch(API_TAREAMARCAR, {
      method: "PUT", // usa PUT porque va a actualizar el estatus de la tarea
      headers: getHeaders(), // manda token y content-type JSON
      body: JSON.stringify({
        idCumplimientoTarea: idCumplimiento, // id del registro de cumplimiento
        nuevoEstatus: nuevoEstatus, // nuevo estatus: Cumplida o Pendiente
      }),
    });

    const data = await res.json(); // obtiene la respuesta del backend

    if (data.success) {
      await gestionarTareas(idasignacion, nombreAlumno); // vuelve a cargar las tareas del alumno para reflejar el cambio
      await verAlumnos(null); // vuelve a cargar la tabla de alumnos para actualizar el progreso
    } else {
      alert("No se pudo actualizar el estatus"); // mensaje si backend responde success false
    }
  } catch (error) {
    console.error("Error al cambiar estatus:", error); // error de red o del fetch
  }
}

// =========================================================
// EVENTOS DE FILTRO
// =========================================================
if (inputBuscarProyecto) {
  inputBuscarProyecto.addEventListener("input", (e) => {
    textoBusquedaProyecto = e.target.value; // guarda el texto del buscador
    aplicarFiltroProyecto(); // vuelve a filtrar la tabla de proyectos
  });
}

if (btnLimpiarFiltroProyecto) {
  btnLimpiarFiltroProyecto.addEventListener("click", limpiarFiltroProyecto); // limpia el filtro al hacer clic
}

// =========================================================
// FUNCIONES GLOBALES
// =========================================================
window.verAlumnos = verAlumnos; // expone función para verla desde onclick del HTML
window.verInfoAlumno = verInfoAlumno; // expone función para abrir info del alumno
window.abrirInfoAlumnoDesdeJSON = abrirInfoAlumnoDesdeJSON; // expone función que reconstruye el objeto alumno desde JSON serializado
window.gestionarTareas = gestionarTareas; // expone función para abrir checklist de tareas
window.cambiarEstatusYRefrescar = cambiarEstatusYRefrescar; // expone función para cambiar estatus de tarea

// =========================================================
// INICIAR CARGA
// =========================================================
document.addEventListener("DOMContentLoaded", cargarMisActividades); // al cargar el DOM, obtiene las actividades del responsable
