// =========================================================
// RECARGA LA PÁGINA SI VIENE DESDE LA CACHÉ DEL NAVEGADOR
// =========================================================
window.addEventListener("pageshow", function (event) {
  if (event.persisted) window.location.reload(); // si la página fue restaurada desde caché (botón atrás/adelante), se recarga para evitar datos viejos
});

// =========================================================
// URL DEL ENDPOINT
// =========================================================
const API_URL = "http://127.0.0.1:3000/api/alumnos-grupo"; // endpoint que devuelve los alumnos de un grupo específico

// =========================================================
// VALIDAR SESIÓN
// =========================================================
(function validarSesion() {
  const usuario = localStorage.getItem("usuario"); // obtiene el usuario guardado en localStorage
  const rol = localStorage.getItem("rol"); // obtiene el rol guardado

  if (!usuario || !rol) {
    // si falta usuario o rol, no hay sesión válida
    window.location.replace("/index.html"); // manda al login
  }
})();

// =========================================================
// VARIABLES GLOBALES
// =========================================================
let listaAlumnos; // referencia al contenedor o tbody donde se mostrarán los alumnos
let sinAlumnos; // referencia al mensaje de "sin alumnos"
let alumnosOriginales = []; // arreglo original con todos los alumnos traídos del servidor
let filtroActual = "todos"; // filtro actual: todos, liberados o pendientes
let textoBusquedaAlumno = ""; // texto escrito en el buscador

// =========================================================
// INICIO
// =========================================================
window.addEventListener("load", () => {
  listaAlumnos = document.getElementById("listaAlumnos"); // obtiene el contenedor de filas de alumnos
  sinAlumnos = document.getElementById("sinAlumnos"); // obtiene el elemento del mensaje cuando no hay alumnos

  const inputBuscarAlumno = document.getElementById("buscarAlumno"); // input de búsqueda por nombre o matrícula
  const btnLimpiarBusquedaAlumno = document.getElementById(
    "btnLimpiarBusquedaAlumno", // botón para limpiar búsqueda
  );

  if (inputBuscarAlumno) {
    inputBuscarAlumno.addEventListener("input", (e) => {
      textoBusquedaAlumno = e.target.value; // guarda el texto actual del buscador
      aplicarFiltroAlumno(); // vuelve a filtrar y renderizar la tabla
    });
  }

  if (btnLimpiarBusquedaAlumno) {
    btnLimpiarBusquedaAlumno.addEventListener("click", () => {
      textoBusquedaAlumno = ""; // limpia el texto guardado

      if (inputBuscarAlumno) {
        inputBuscarAlumno.value = ""; // limpia visualmente el input
      }

      aplicarFiltroAlumno(); // vuelve a mostrar resultados sin búsqueda
    });
  }

  const urlParams = new URLSearchParams(window.location.search); // lee los parámetros de la URL actual
  const idGrupo = urlParams.get("id"); // obtiene el id del grupo, por ejemplo grupos-alumnos.html?id=3

  if (idGrupo) {
    cargarAlumnos(idGrupo); // si hay id de grupo, carga sus alumnos
  } else {
    window.location.href = "grupos.html"; // si no hay id, redirige al listado de grupos
  }
});

// =========================================================
// UTILIDAD FOTO
// =========================================================
function obtenerFotoAlumno(foto) {
  return foto && String(foto).trim() !== "" ? foto : "/img/default-user.png"; // si el alumno tiene foto, la usa; si no, pone imagen por defecto
}

// =========================================================
// CARGAR ALUMNOS DESDE EL SERVIDOR
// =========================================================
async function cargarAlumnos(idGrupo) {
  try {
    const res = await fetch(`${API_URL}?id=${idGrupo}`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"), // manda el token JWT para autenticar la petición
      },
    });

    if (res.status === 401) {
      // si el backend responde no autorizado
      return window.location.replace("/index.html"); // manda al login
    }

    const alumnos = await res.json(); // convierte la respuesta a JSON
    alumnosOriginales = Array.isArray(alumnos) ? alumnos : []; // guarda el arreglo si realmente es un array; si no, guarda vacío

    if (alumnosOriginales.length > 0 && alumnosOriginales[0].grupo) {
      // si al menos hay un alumno y viene el nombre del grupo
      document.getElementById("tituloPagina").innerText =
        `Alumnos del Grupo: ${alumnosOriginales[0].grupo}`; // cambia el título para mostrar el grupo actual
    }

    actualizarResumen(); // actualiza las tarjetas resumen
    actualizarTarjetasFiltro(); // marca la tarjeta de filtro actual
    aplicarFiltroAlumno(); // aplica filtro y renderiza la tabla
  } catch (error) {
    console.error("Error al cargar alumnos:", error); // muestra error en consola
    alumnosOriginales = []; // deja el arreglo vacío si hubo error
    actualizarResumen(); // actualiza resumen con datos vacíos
    actualizarTarjetasFiltro(); // actualiza estado visual de filtros
    aplicarFiltroAlumno(); // renderiza vista vacía
  }
}

// =========================================================
// SABER SI UN ALUMNO YA ESTÁ LIBERADO
// =========================================================
function estaLiberado(alumno) {
  return Number(alumno.horas_liberadas || 0) >= 480; // devuelve true si el alumno ya llegó o superó las 480 horas
}

// =========================================================
// CAMBIAR FILTRO
// =========================================================
function cambiarFiltroAlumno(tipo) {
  filtroActual = tipo; // cambia el filtro global actual
  actualizarTarjetasFiltro(); // actualiza la tarjeta resaltada
  aplicarFiltroAlumno(); // aplica el nuevo filtro y renderiza
}

// =========================================================
// ACTUALIZAR TARJETA ACTIVA
// =========================================================
function actualizarTarjetasFiltro() {
  const cardTodos = document.getElementById("cardFiltroTodos"); // tarjeta filtro "todos"
  const cardLiberados = document.getElementById("cardFiltroLiberados"); // tarjeta filtro "liberados"
  const cardPendientes = document.getElementById("cardFiltroPendientes"); // tarjeta filtro "pendientes"

  cardTodos?.classList.remove("activo"); // quita clase activa a "todos" si existe
  cardLiberados?.classList.remove("activo"); // quita clase activa a "liberados" si existe
  cardPendientes?.classList.remove("activo"); // quita clase activa a "pendientes" si existe

  if (filtroActual === "todos") {
    cardTodos?.classList.add("activo"); // activa la tarjeta de "todos"
  }

  if (filtroActual === "liberados") {
    cardLiberados?.classList.add("activo"); // activa la tarjeta de "liberados"
  }

  if (filtroActual === "pendientes") {
    cardPendientes?.classList.add("activo"); // activa la tarjeta de "pendientes"
  }
}

// =========================================================
// ACTUALIZAR TARJETAS RESUMEN
// =========================================================
function actualizarResumen() {
  const total = alumnosOriginales.length; // total de alumnos cargados
  const liberados = alumnosOriginales.filter((a) => estaLiberado(a)).length; // cuenta cuántos ya están liberados
  const pendientes = total - liberados; // calcula cuántos siguen pendientes

  const cardTotalAlumnos = document.getElementById("cardTotalAlumnos"); // tarjeta de total alumnos
  const cardLiberados = document.getElementById("cardLiberados"); // tarjeta de liberados
  const cardPendientes = document.getElementById("cardPendientes"); // tarjeta de pendientes

  if (cardTotalAlumnos) cardTotalAlumnos.innerText = total; // actualiza total
  if (cardLiberados) cardLiberados.innerText = liberados; // actualiza liberados
  if (cardPendientes) cardPendientes.innerText = pendientes; // actualiza pendientes
}

// =========================================================
// APLICAR FILTRO
// =========================================================
function aplicarFiltroAlumno() {
  let filtrados = [...alumnosOriginales]; // crea una copia del arreglo original para no modificarlo

  if (filtroActual === "liberados") {
    filtrados = filtrados.filter((alumno) => estaLiberado(alumno)); // deja solo alumnos liberados
  }

  if (filtroActual === "pendientes") {
    filtrados = filtrados.filter((alumno) => !estaLiberado(alumno)); // deja solo alumnos pendientes
  }

  if (textoBusquedaAlumno.trim() !== "") {
    const texto = textoBusquedaAlumno.toLowerCase(); // normaliza el texto a minúsculas

    filtrados = filtrados.filter((alumno) => {
      const nombre = (alumno.nombre || "").toLowerCase(); // nombre del alumno en minúsculas
      const matricula = (alumno.matricula || "").toLowerCase(); // matrícula en minúsculas
      return nombre.includes(texto) || matricula.includes(texto); // deja pasar si coincide en nombre o matrícula
    });
  }

  mostrarAlumnos(filtrados); // renderiza la tabla con los resultados finales
}

// =========================================================
// RENDER DE ACTIVIDADES DEL ALUMNO
// =========================================================
function renderActividades(actividades) {
  if (!actividades || actividades.length === 0) {
    // si no hay actividades
    return `<span class="text-muted fst-italic">Sin actividades registradas</span>`; // devuelve texto por defecto
  }

  return actividades
    .map((act) => {
      const esCompleta = act.estatus === "completada"; // revisa si la actividad ya está completada
      const clase = esCompleta
        ? "actividad-mini completa" // clase CSS para actividad completada
        : "actividad-mini proceso"; // clase CSS para actividad en proceso
      const icono = esCompleta
        ? "fas fa-check-circle" // ícono de completada
        : "fas fa-hourglass-half"; // ícono de en proceso
      const estatusTexto = esCompleta ? "Completada" : "En proceso"; // texto visual del estatus

      return `
        <div class="${clase}">
          <i class="${icono} me-1"></i>
          ${act.nombre} — ${act.horas} hrs (${estatusTexto})
        </div>
      `; // genera el HTML de una mini actividad
    })
    .join(""); // une todas las mini actividades en un solo string HTML
}

// =========================================================
// MOSTRAR ALUMNOS EN TABLA
// =========================================================
function mostrarAlumnos(alumnos) {
  listaAlumnos.innerHTML = ""; // limpia el contenido actual antes de volver a renderizar

  if (!alumnos || alumnos.length === 0) {
    // si no hay alumnos a mostrar
    sinAlumnos.style.display = "block"; // muestra mensaje de "sin alumnos"
    return;
  }

  sinAlumnos.style.display = "none"; // oculta mensaje si sí hay alumnos

  alumnos.forEach((alumno) => {
    const horas = Number(alumno.horas_liberadas || 0); // convierte las horas liberadas a número
    const porcentaje = Math.min(100, Math.round((horas / 480) * 100)); // calcula porcentaje de avance, con tope de 100
    const liberado = estaLiberado(alumno); // indica si ya liberó servicio

    listaAlumnos.innerHTML += `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <img
              src="${obtenerFotoAlumno(alumno.foto_perfil)}"
              alt="Foto de ${alumno.nombre}"
              style="width:52px; height:52px; object-fit:cover; border-radius:50%; border:2px solid #d9d9d9;"
            />
            <div>
              <div class="fw-bold text-primary nombre-tabla">${alumno.nombre}</div>
              <div class="text-muted small">${alumno.matricula}</div>
            </div>
          </div>
        </td>

        <td>
          <div><i class="fas fa-envelope me-2 text-primary"></i>${alumno.email || "Sin correo"}</div>
          <div><i class="fas fa-phone me-2 text-primary"></i>${alumno.telefono || "Sin teléfono"}</div>
        </td>

        <td style="min-width: 220px;">
          <div class="d-flex justify-content-between small mb-1">
            <span class="fw-semibold">${horas} / 480 hrs</span>
            <span class="${liberado ? "text-success" : "text-warning"} fw-bold">
              ${porcentaje}%
            </span>
          </div>
          <div class="progress" style="height: 10px;">
            <div
              class="progress-bar ${liberado ? "bg-success" : "bg-warning"}"
              role="progressbar"
              style="width: ${porcentaje}%"
              aria-valuenow="${porcentaje}"
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
        </td>

        <td>
          <span class="badge estado-badge ${liberado ? "estado-liberado" : "estado-pendiente"}">
            ${liberado ? "Liberado" : "Pendiente"}
          </span>
        </td>

        <td style="min-width: 280px;">
          ${renderActividades(alumno.actividades)}
        </td>
      </tr>
    `; // agrega una fila completa por cada alumno con foto, datos, barra de progreso, estatus y actividades
  });
}

// =========================================================
// FUNCIÓN GLOBAL
// =========================================================
window.cambiarFiltroAlumno = cambiarFiltroAlumno; // expone la función al scope global para poder usarla desde onclick en HTML
