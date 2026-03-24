/* =========================
   VALIDAR SESIÓN
========================= */
(function validarSesion() {
  // const usuario guarda el nombre del usuario logueado en el localStorage
  const usuario = localStorage.getItem("usuario");
  // const rol guarda el rol del usuario logueado en el localStorage, en minusculas para evitar problemas
  const rol = localStorage.getItem("rol")?.toLowerCase();

  // si no hay usuario o rol en el localStorage, se redirige al index o login
  if (!usuario || !rol) {
    window.location.replace("/index.html");
  }
})();

/* =========================
   URLS de las APIs
========================= */
const API_URL = "http://127.0.0.1:3000/api/actividad"; // API de actividades
const API_TAREAS = "http://127.0.0.1:3000/api/tareas"; // API de tareas

/* =========================
   VARIABLES GLOBALES
========================= */
let listaActividades, sinActividades; // LISTA DE ACTIVIDADES, estas son las que se muestran en la tabla
let modal; // MODAL ACTIVIDAD, esta es la que se muestra al crear o editar una actividad

// MODALES TAREAS
let modalTareas, modalFormTarea;

let inputId,
  inputNombre,
  inputDescripcion,
  inputAlumnos,
  inputHoras,
  inputInicio,
  inputFin;

// INPUTS TAREA
let inputTareaId, inputNombreTarea, inputHorasTarea, inputFechaTarea;

// CONTROL GLOBAL
let idActividadActual = null; // ID DE LA ACTIVIDAD ACTUAL, es null por defecto y se cambia cuando se selecciona una actividad

/* =========================
   Encabezados con token
========================= */
function getHeaders() {
  // Función para obtener los encabezados
  return {
    // se retorna un objeto con los encabezados
    "Content-Type": "application/json",
    // "Content-Type": "application/json", es para indicar que se estan enviando datos en formato JSON
    Authorization: "Bearer " + localStorage.getItem("token"),
    // "Authorization": "Bearer " muestra el token
    // localStorage.getItem("token") obtiene el token del localStorage
  };
}

/* =========================
   INICIO
========================= */
window.addEventListener("load", () => {
  // Escuchar los evento de carga de la ventana

  // LISTA DE ACTIVIDADES
  listaActividades = document.getElementById("listaActividades");
  sinActividades = document.getElementById("sinActividades");

  // INPUTS de actividad
  inputId = document.getElementById("actividadId");
  inputNombre = document.getElementById("nombreActividad");
  inputDescripcion = document.getElementById("descripcion");
  inputHoras = document.getElementById("horas");
  inputAlumnos = document.getElementById("totalAlumnos");
  inputInicio = document.getElementById("fechaInicio");
  inputFin = document.getElementById("fechaFin");

  // MODALES
  modal = new bootstrap.Modal(document.getElementById("modalActividad"));
  modalTareas = new bootstrap.Modal(document.getElementById("modalTareas"));
  modalFormTarea = new bootstrap.Modal(
    document.getElementById("modalFormTarea"),
  );

  // INPUTS TAREA
  inputTareaId = document.getElementById("tareaId");
  inputNombreTarea = document.getElementById("nombreTarea");
  inputHorasTarea = document.getElementById("horasTarea");
  inputFechaTarea = document.getElementById("fechaTarea");

  // const rol = localStorage.getItem("rol");, esto es para obtener el rol del usuario del localStorage
  const rol = localStorage.getItem("rol");

  // si el rol es "tutor" , "alumno" o "director", se oculta el boton de "nueva actividad", esto porque su rol no puede crear actividades
  if (rol === "tutor" || rol === "director" || rol === "alumno") {
    const btnNuevo = document.getElementById("btnNuevaActividad");
    if (btnNuevo) btnNuevo.style.display = "none";
  }

  // CARGAR ACTIVIDADES
  cargarActividades();
});

/* =========================
   NUEVA ACTIVIDAD
========================= */
function abrirNuevo() {
  // FUNCION PARA ABRIR EL MODAL DE NUEVA ACTIVIDAD
  modal.show(); // MOSTRAR MODAL

  // LIMPIAR ID (esto es CLAVE para que sea "nuevo")
  inputId.value = "";

  // LIMPIAR CAMPOS
  inputNombre.value = "";
  inputDescripcion.value = "";
  inputHoras.value = "";
  inputAlumnos.value = "";
  inputInicio.value = "";
  inputFin.value = "";
}

/* =========================
   CARGAR ACTIVIDADES
========================= */
async function cargarActividades() {
  try {
    const res = await fetch(API_URL, {
      headers: getHeaders(),
    });

    if (res.status === 401) return cerrarSesion();

    const data = await res.json();
    mostrarActividades(data);
  } catch (error) {
    console.error(error);
  }
}

/* =========================
   MOSTRAR ACTIVIDADES
========================= */
function mostrarActividades(actividades) {
  listaActividades.innerHTML = "";
  const rol = localStorage.getItem("rol");

  if (!actividades || actividades.length === 0) {
    sinActividades.style.display = "block";
    return;
  }

  sinActividades.style.display = "none";

  // ORDEN: no inscritos arriba, inscritos abajo
  actividades.sort((a, b) => {
    return (a.inscrito === 1) - (b.inscrito === 1);
  });

  actividades.forEach((act) => {
    const inscritos = act.inscritos || 0;
    const cupo = act.totalAlumnosRequeridos || 0;
    const restantes = cupo - inscritos;
    const lleno = restantes <= 0;
    const yaInscrito = act.inscrito == 1;

    listaActividades.innerHTML += `
      <div class="card mb-3 shadow ${yaInscrito ? "opacity-50" : ""}">
        <div class="card-body text-center">
          
          <h5>${act.nombreActividad}</h5>
          <p>${act.descripcion || "Sin descripción"}</p>

          <p> Responsable: ${act.responsable || "Sin asignar"}</p>

          <p> Horas: ${act.horas_actividad}</p>

          <p> Cupo: ${inscritos} / ${cupo}</p>
          <p> Disponibles: ${restantes}</p>

          <p> Inicio: ${act.fecha_alta?.split("T")[0]}</p>
          <p> Fin: ${act.fechaTermino?.split("T")[0]}</p>

          <div class="mt-3 d-flex justify-content-center gap-2">

            <button class="btn btn-info btn-sm" onclick="verTareas(${act.idactividad})">
              Tareas
            </button>

            ${
              rol === "alumno"
                ? `
                <button 
                  class="btn btn-sm ${
                    yaInscrito
                      ? "btn-secondary"
                      : lleno
                        ? "btn-danger"
                        : "btn-success"
                  }"
                  onclick="unirme(${act.idactividad})"
                  ${yaInscrito || lleno ? "disabled" : ""}
                >
                  ${yaInscrito ? "Inscrito" : lleno ? "Lleno" : "Unirme"}
                </button>
              `
                : ""
            }

            ${
              rol !== "alumno" && rol !== "tutor" && rol !== "director"
                ? `
                <button class="btn btn-warning btn-sm" onclick='editar(${JSON.stringify(act)})'>
                  Editar
                </button>
                <button class="btn btn-danger btn-sm" onclick="eliminar(${act.idactividad})">
                  Eliminar
                </button>
              `
                : ""
            }

          </div>
        </div>
      </div>
    `;
  });
}

// Unirse el alumno a las actividades
async function unirme(idactividad) {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/asignacion", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ idactividad }),
    });

    const data = await res.json();

    // SI HAY ERROR
    if (!res.ok) {
      const msg = data.msg?.toLowerCase() || "";

      if (msg.includes("480") || msg.includes("horas")) {
        alert("⚠️ No puedes unirte: superarías las 480 horas");
      } else if (msg.includes("llena")) {
        alert("❌ Esta actividad ya está llena");
      } else if (msg.includes("inscrito")) {
        alert("⚠️ Ya estás inscrito en esta actividad");
      } else {
        alert(data.msg || "Error desconocido");
      }

      return;
    }

    // ÉXITO
    alert(data.msg || "✅ Te uniste a la actividad");

    // Recargar lista para actualizar botones, cupos, etc.
    cargarActividades();
  } catch (error) {
    console.error("Error en unirme:", error);
    alert("Error de conexión con el servidor");
  }
}

/* =========================
   TAREAS
========================= */

// VER TAREAS
async function verTareas(idactividad) {
  idActividadActual = idactividad;

  try {
    const resAct = await fetch(API_URL, {
      headers: getHeaders(),
    });
    const actividades = await resAct.json();

    actividadActual = actividades.find((a) => a.idactividad == idactividad);

    document.getElementById("nombreActividadModal").textContent =
      actividadActual?.nombreActividad || "";

    const res = await fetch(`${API_TAREAS}/${idactividad}`, {
      headers: getHeaders(),
    });

    const data = await res.json();

    let total = 0;
    let html = "";

    const rol = localStorage.getItem("rol");

    data.forEach((t) => {
      total += Number(t.horas_Tareas);

      html += `
        <tr>
          <td>${t.nombre_tarea}</td>
          <td>${t.horas_Tareas}</td>
          <td>${t.fechaEjecucion}</td>
          <td>
            ${
              rol !== "tutor" && rol !== "director"
                ? `
              <button class="btn btn-warning btn-sm" onclick="editarTarea(${t.idTareas_Actividad}, '${t.nombre_tarea}', ${t.horas_Tareas}, '${t.fechaEjecucion}')">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="eliminarTarea(${t.idTareas_Actividad})">🗑</button>
            `
                : `<span class="text-muted">Solo lectura</span>`
            }
          </td>
        </tr>
      `;
    });

    document.getElementById("tablaTareas").innerHTML = html;

    const totalActividad = Number(actividadActual.horas_actividad);
    const restantes = totalActividad - total;

    const btnNueva = document.querySelector("#modalTareas .btn-success");

    // BLOQUEO POR ROL
    if (rol === "tutor" || rol === "director" || rol === "alumno") {
      btnNueva.style.display = "none";
    } else {
      if (restantes <= 0) {
        btnNueva.disabled = true;
        btnNueva.textContent = "Horas completas";
      } else {
        btnNueva.disabled = false;
        btnNueva.textContent = "+ Nueva tarea";
      }
    }

    const info = document.getElementById("infoHoras");

    info.textContent = `Horas usadas: ${total} / ${totalActividad} | Restantes: ${restantes}`;

    info.className =
      restantes < 0 ? "mt-2 fw-bold text-danger" : "mt-2 fw-bold text-success";

    modalTareas.show();
  } catch (error) {
    console.error(error);
  }
}

// ABRIR FORM
function abrirNuevaTarea() {
  const rol = localStorage.getItem("rol"); // PROTECCIÓN EXTRA

  if (rol === "tutor" || rol === "director" || rol === "alumno") {
    alert("No tienes permisos para agregar tareas");
    return;
  }

  inputTareaId.value = "";
  inputNombreTarea.value = "";
  inputHorasTarea.value = "";
  inputFechaTarea.value = "";

  modalFormTarea.show();
}

// EDITAR TAREA
function editarTarea(id, nombre, horas, fecha) {
  inputTareaId.value = id;
  inputNombreTarea.value = nombre;
  inputHorasTarea.value = horas;
  inputFechaTarea.value = fecha;

  modalFormTarea.show();
}

// ELIMINAR
async function eliminarTarea(id) {
  await fetch(`${API_TAREAS}/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  verTareas(idActividadActual);
}

/* =========================
   GUARDAR TAREA
========================= */
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "formTarea") return;

  e.preventDefault();

  const id = inputTareaId.value;

  const data = {
    idactividad: idActividadActual,
    nombre_tarea: inputNombreTarea.value,
    horas_Tareas: inputHorasTarea.value,
    fechaEjecucion: inputFechaTarea.value,
  };

  try {
    if (!id) {
      const res = await fetch(API_TAREAS, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        alert("Ya superaste las horas globales de la actividad");
        return;
      }
    } else {
      const res = await fetch(`${API_TAREAS}/${id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        alert("Ya superaste las horas globales de la actividad");
        return;
      }
    }

    modalFormTarea.hide();
    verTareas(idActividadActual);
  } catch (error) {
    console.error(error);
  }
});

/* =========================
   CREAR / EDITAR ACTIVIDAD
========================= */
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "formActividad") return;

  e.preventDefault();

  const id = inputId.value;

  const data = {
    nombreActividad: inputNombre.value,
    descripcion: inputDescripcion.value,
    horas_actividad: inputHoras.value,
    fecha_alta: inputInicio.value,
    fechaTermino: inputFin.value,
    totalAlumnosRequeridos: inputAlumnos.value,
  };

  try {
    let res;

    if (!id) {
      res = await fetch(API_URL, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
    } else {
      res = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
    }

    if (res.status === 401) return cerrarSesion();

    if (res.status === 403) {
      alert("No tienes permisos");
      return;
    }

    const result = await res.json();

    if (!result.success) {
      alert("Error al guardar");
      return;
    }

    modal.hide();
    cargarActividades();
  } catch (error) {
    console.error(error);
  }
});

/* =========================
   EDITAR ACTIVIDAD
========================= */
function editar(act) {
  modal.show();

  inputId.value = act.idactividad;
  inputNombre.value = act.nombreActividad;
  inputDescripcion.value = act.descripcion;
  inputHoras.value = act.horas_actividad;
  inputAlumnos.value = act.totalAlumnosRequeridos || "";
  inputInicio.value = act.fecha_alta?.split("T")[0];
  inputFin.value = act.fechaTermino?.split("T")[0];
}

/* =========================
   ELIMINAR ACTIVIDAD
========================= */
async function eliminar(id) {
  if (!confirm("¿Seguro que quieres eliminar esta actividad?")) return;

  try {
    await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    cargarActividades();
  } catch (error) {
    console.error(error);
  }
}

/* =========================
   GLOBALES, son las funciones que se llaman desde el HTML
========================= */
window.editar = editar;
window.eliminar = eliminar;
window.abrirNuevo = abrirNuevo;
window.verTareas = verTareas;
window.abrirNuevaTarea = abrirNuevaTarea;
window.editarTarea = editarTarea;
window.eliminarTarea = eliminarTarea;
window.unirme = unirme;
