/* =========================================================
   VARIABLES DE LAS APIs
========================================================= */
const API_ACTIVIDADES = "http://127.0.0.1:3000/api/actividad";
const API_ALUMNOS = "http://127.0.0.1:3000/api/seguimiento/alumnos";
const API_TAREAS = "http://127.0.0.1:3000/api/seguimiento/tareas-alumno";
const API_TAREAMARCAR = "http://127.0.0.1:3000/api/seguimiento/marcar-tarea";

/* =========================================================
   VARIABLES GLOBALES
========================================================= */
let idActividadActual = null;
let actividadesOriginales = [];
let textoBusquedaProyecto = "";
let nombreProyectoActual = "";
let nombreAlumnoActual = "";

/* =========================================================
   REFERENCIAS AL DOM
========================================================= */
const listaActividades = document.getElementById("listaActividadesResponsable");
const tablaAlumnos = document.getElementById("tablaAlumnosInscritos");
const contenedorChecklist = document.getElementById("listaChecklistTareas");
const inputBuscarProyecto = document.getElementById("buscarProyecto");
const btnLimpiarFiltroProyecto = document.getElementById(
  "btnLimpiarFiltroProyecto",
);
const tituloModalAlumnos = document.getElementById("tituloModalAlumnos");
const subtituloModalAlumnos = document.getElementById("subtituloModalAlumnos");
const tituloModalChecklist = document.getElementById("tituloModalChecklist");
const subtituloModalChecklist = document.getElementById(
  "subtituloModalChecklist",
);

/* =========================================================
   REFERENCIAS MODAL INFO
========================================================= */
const infoAlumnoFoto = document.getElementById("infoAlumnoFoto");
const infoAlumnoNombre = document.getElementById("infoAlumnoNombre");
const infoAlumnoMatricula = document.getElementById("infoAlumnoMatricula");
const infoAlumnoGrupo = document.getElementById("infoAlumnoGrupo");
const infoAlumnoTutor = document.getElementById("infoAlumnoTutor");
const infoAlumnoTelefono = document.getElementById("infoAlumnoTelefono");
const infoAlumnoCorreo = document.getElementById("infoAlumnoCorreo");

/* =========================================================
   MODALES
========================================================= */
const modalAlumnos = new bootstrap.Modal(
  document.getElementById("modalAlumnos"),
);

const modalInfoAlumno = new bootstrap.Modal(
  document.getElementById("modalInfoAlumno"),
);

const modalTareas = new bootstrap.Modal(
  document.getElementById("modalTareasAlumno"),
);

/* =========================================================
   HEADERS CON TOKEN
========================================================= */
function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
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

function buscarActividadPorId(idactividad) {
  return actividadesOriginales.find(
    (act) => Number(act.idactividad) === Number(idactividad),
  );
}

function obtenerFotoAlumno(foto) {
  return foto && String(foto).trim() !== "" ? foto : "/img/default-user.png";
}

/* =========================================================
   RENDERIZAR PROYECTOS EN LA TABLA
========================================================= */
function renderActividades(actividades) {
  if (!listaActividades) return;

  listaActividades.innerHTML = "";

  if (!actividades || actividades.length === 0) {
    listaActividades.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-muted">
          No se encontraron proyectos con ese filtro.
        </td>
      </tr>
    `;
    return;
  }

  actividades.forEach((act) => {
    const descripcion = act.descripcion
      ? act.descripcion.length > 100
        ? act.descripcion.substring(0, 100) + "..."
        : act.descripcion
      : "Sin descripción detallada.";

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
    `;
  });
}

/* =========================================================
   APLICAR FILTRO POR NOMBRE DEL PROYECTO
========================================================= */
function aplicarFiltroProyecto() {
  let filtradas = [...actividadesOriginales];

  if (textoBusquedaProyecto.trim() !== "") {
    filtradas = filtradas.filter((act) =>
      (act.nombreActividad || "")
        .toLowerCase()
        .includes(textoBusquedaProyecto.toLowerCase()),
    );
  }

  renderActividades(filtradas);
}

/* =========================================================
   LIMPIAR FILTRO
========================================================= */
function limpiarFiltroProyecto() {
  textoBusquedaProyecto = "";

  if (inputBuscarProyecto) {
    inputBuscarProyecto.value = "";
  }

  renderActividades(actividadesOriginales);
}

/* =========================================================
   CARGAR ACTIVIDADES DEL RESPONSABLE
========================================================= */
async function cargarMisActividades() {
  try {
    const res = await fetch(API_ACTIVIDADES, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!res.ok) {
      const textoError = await res.text();
      console.error("Error del servidor:", textoError);
      throw new Error("Respuesta no válida");
    }

    const actividades = await res.json();
    actividadesOriginales = Array.isArray(actividades) ? actividades : [];
    aplicarFiltroProyecto();
  } catch (error) {
    console.error("Error al cargar actividades:", error);

    if (listaActividades) {
      listaActividades.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-danger">
            Error al conectar con el servidor.
          </td>
        </tr>
      `;
    }
  }
}

/* =========================================================
   ABRIR MODAL DE INFO DEL ALUMNO
========================================================= */
function verInfoAlumno(alumno) {
  if (!alumno) return;

  if (infoAlumnoFoto) {
    infoAlumnoFoto.src = obtenerFotoAlumno(alumno.foto_perfil);
  }

  if (infoAlumnoNombre) {
    infoAlumnoNombre.value = alumno.nombre_alumno || "";
  }

  if (infoAlumnoMatricula) {
    infoAlumnoMatricula.value = alumno.matricula || "";
  }

  if (infoAlumnoGrupo) {
    infoAlumnoGrupo.value = alumno.grupo || "Sin grupo";
  }

  if (infoAlumnoTutor) {
    infoAlumnoTutor.value = alumno.nombre_tutor || "Sin tutor asignado";
  }

  if (infoAlumnoTelefono) {
    infoAlumnoTelefono.value = alumno.telefono || "Sin teléfono";
  }

  if (infoAlumnoCorreo) {
    infoAlumnoCorreo.value = alumno.email || "Sin correo";
  }

  modalInfoAlumno.show();
}

/* =========================================================
   VER ALUMNOS INSCRITOS EN UNA ACTIVIDAD
========================================================= */
async function verAlumnos(idactividad) {
  if (idactividad) {
    idActividadActual = idactividad;
  }

  const actividadActual = buscarActividadPorId(idActividadActual);
  nombreProyectoActual = actividadActual?.nombreActividad || "";

  if (tituloModalAlumnos) {
    tituloModalAlumnos.textContent = `Alumnos inscritos en el proyecto: ${nombreProyectoActual}`;
  }

  if (subtituloModalAlumnos) {
    subtituloModalAlumnos.textContent =
      "Consulta el progreso real de tareas de cada alumno inscrito.";
  }

  try {
    const res = await fetch(`${API_ALUMNOS}/${idActividadActual}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const alumnos = await res.json();
    tablaAlumnos.innerHTML = "";

    if (!alumnos || alumnos.length === 0) {
      tablaAlumnos.innerHTML = `
        <tr>
          <td colspan="3" class="text-center p-4">
            No hay alumnos inscritos en esta actividad.
          </td>
        </tr>
      `;
      modalAlumnos.show();
      return;
    }

    alumnos.forEach((alum) => {
      const progreso =
        alum.total_tareas > 0
          ? Math.round((alum.tareas_listas / alum.total_tareas) * 100)
          : 0;

      const alumnoSeguro = encodeURIComponent(JSON.stringify(alum));

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
      `;
    });

    modalAlumnos.show();
  } catch (error) {
    console.error("Error al obtener alumnos:", error);
  }
}

/* =========================================================
   ABRIR INFO DESDE JSON SERIALIZADO
========================================================= */
function abrirInfoAlumnoDesdeJSON(alumnoSerializado) {
  try {
    const alumno = JSON.parse(decodeURIComponent(alumnoSerializado));
    verInfoAlumno(alumno);
  } catch (error) {
    console.error("Error al abrir info del alumno:", error);
  }
}

/* =========================================================
   OBTENER TAREAS DEL ALUMNO
========================================================= */
async function gestionarTareas(idasignacion, nombreAlumno = "") {
  nombreAlumnoActual = nombreAlumno || "";

  if (tituloModalChecklist) {
    tituloModalChecklist.textContent = "Checklist de Tareas";
  }

  if (subtituloModalChecklist) {
    if (nombreAlumnoActual && nombreProyectoActual) {
      subtituloModalChecklist.textContent = `Alumno: ${nombreAlumnoActual} | Proyecto: ${nombreProyectoActual}`;
    } else if (nombreProyectoActual) {
      subtituloModalChecklist.textContent = `Proyecto: ${nombreProyectoActual}`;
    } else {
      subtituloModalChecklist.textContent = "";
    }
  }

  try {
    const res = await fetch(`${API_TAREAS}/${idasignacion}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const tareas = await res.json();
    contenedorChecklist.innerHTML = "";

    if (!tareas || tareas.length === 0) {
      contenedorChecklist.innerHTML = `
        <div class="list-group-item text-center text-muted py-3">
          No hay tareas registradas para este alumno.
        </div>
      `;
      modalTareas.show();
      return;
    }

    tareas.forEach((t) => {
      const esCumplida = t.estatus === "Cumplida";

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
      `;
    });

    modalTareas.show();
  } catch (error) {
    console.error("Error al obtener tareas:", error);
  }
}

/* =========================================================
   CAMBIAR ESTATUS DE TAREA Y REFRESCAR
========================================================= */
async function cambiarEstatusYRefrescar(
  idCumplimiento,
  nuevoEstatus,
  idasignacion,
  nombreAlumno = "",
) {
  try {
    const res = await fetch(API_TAREAMARCAR, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({
        idCumplimientoTarea: idCumplimiento,
        nuevoEstatus: nuevoEstatus,
      }),
    });

    const data = await res.json();

    if (data.success) {
      await gestionarTareas(idasignacion, nombreAlumno);
      await verAlumnos(null);
    } else {
      alert("No se pudo actualizar el estatus");
    }
  } catch (error) {
    console.error("Error al cambiar estatus:", error);
  }
}

/* =========================================================
   EVENTOS DE FILTRO
========================================================= */
if (inputBuscarProyecto) {
  inputBuscarProyecto.addEventListener("input", (e) => {
    textoBusquedaProyecto = e.target.value;
    aplicarFiltroProyecto();
  });
}

if (btnLimpiarFiltroProyecto) {
  btnLimpiarFiltroProyecto.addEventListener("click", limpiarFiltroProyecto);
}

/* =========================================================
   FUNCIONES GLOBALES
========================================================= */
window.verAlumnos = verAlumnos;
window.verInfoAlumno = verInfoAlumno;
window.abrirInfoAlumnoDesdeJSON = abrirInfoAlumnoDesdeJSON;
window.gestionarTareas = gestionarTareas;
window.cambiarEstatusYRefrescar = cambiarEstatusYRefrescar;

/* =========================================================
   INICIAR CARGA
========================================================= */
document.addEventListener("DOMContentLoaded", cargarMisActividades);
