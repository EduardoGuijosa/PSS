/* =========================================================
   RECARGA SI LA PÁGINA VIENE DE LA CACHÉ DEL NAVEGADOR
========================================================= */

// pageshow se dispara cuando la página vuelve a mostrarse
// event.persisted significa que el navegador cargó la página desde caché
// Si eso pasa, recargamos para evitar datos viejos o vistas desactualizadas
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});

/* =========================================================
   URL DEL ENDPOINT
========================================================= */

// Esta constante guarda la ruta de la API que devuelve la lista de grupos
const API_URL = "http://127.0.0.1:3000/api/grupos";

/* =========================================================
   VARIABLES PARA BÚSQUEDA Y FILTRADO
========================================================= */

// gruposOriginales guarda todos los grupos recibidos desde el backend
// Sirve para poder aplicar filtros sin volver a consultar la API cada vez
let gruposOriginales = [];

// textoBusquedaGrupo guarda lo que el usuario escribe en el buscador
let textoBusquedaGrupo = "";

/* =========================================================
   VALIDAR SESIÓN
   - Si no hay usuario o rol, redirige al login
========================================================= */

// Esta función autoejecutable comprueba si existe una sesión activa
(function validarSesion() {
  // Si no hay usuario o rol guardado en localStorage, se manda al login
  if (!localStorage.getItem("usuario") || !localStorage.getItem("rol")) {
    window.location.replace("/index.html");
  }
})();

/* =========================================================
   INICIO DE LA PÁGINA
   - Obtiene referencias del DOM
   - Aplica reglas según el rol
   - Configura el buscador
   - Carga grupos desde la API
========================================================= */

// Este bloque se ejecuta cuando la ventana terminó de cargar
window.addEventListener("load", () => {
  // Referencia al input del buscador de grupos
  const inputBuscarGrupo = document.getElementById("buscarGrupo");

  // Referencia al contenedor completo del filtro de grupos
  const contenedorFiltroGrupo = document.getElementById(
    "contenedorFiltroGrupo",
  );

  // Se obtiene el rol del usuario logueado
  const rol = localStorage.getItem("rol")?.toLowerCase();

  // Si el rol es tutor, se oculta el filtro porque normalmente tiene pocos grupos
  if (rol === "tutor" && contenedorFiltroGrupo) {
    contenedorFiltroGrupo.style.display = "none";
  }

  // Si NO es tutor, se activa el buscador
  // Cada vez que el usuario escribe, se guarda el texto y se vuelve a filtrar
  if (rol !== "tutor" && inputBuscarGrupo) {
    inputBuscarGrupo.addEventListener("input", (e) => {
      textoBusquedaGrupo = e.target.value;
      aplicarFiltroGrupo();
    });
  }

  // Finalmente se cargan los grupos desde el servidor
  cargarGrupos();
});

/* =========================================================
   CARGAR GRUPOS DESDE EL BACKEND
========================================================= */

// Esta función consulta al backend para obtener todos los grupos visibles
async function cargarGrupos() {
  try {
    // Se hace una petición GET a la API enviando el token en headers
    const res = await fetch(API_URL, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
    });

    // Si la sesión ya no es válida, se manda al login
    if (res.status === 401) return window.location.replace("/index.html");

    // Se convierte la respuesta a JSON
    const datos = await res.json();

    // Validación importante:
    // Si el backend no devolvió un arreglo, algo salió mal
    if (!Array.isArray(datos)) {
      console.error("Error del servidor:", datos.error);

      // Se limpia la tabla mostrando un arreglo vacío
      mostrarGrupos([]);
      return;
    }

    // Se guardan todos los grupos originales
    gruposOriginales = datos;

    // Se aplican filtros sobre esos datos
    aplicarFiltroGrupo();
  } catch (error) {
    // Si falla la petición, se muestra el error en consola
    console.error("Error al cargar grupos:", error);

    // Se limpia la vista
    mostrarGrupos([]);
  }
}

/* =========================================================
   APLICAR FILTRO DE GRUPOS
   - Filtra por nombre del grupo
========================================================= */

// Esta función toma gruposOriginales y aplica el texto escrito en el buscador
function aplicarFiltroGrupo() {
  // Se crea una copia del arreglo original
  let filtrados = [...gruposOriginales];

  // Si el buscador tiene texto, se filtra por el nombre del grupo
  if (textoBusquedaGrupo.trim() !== "") {
    filtrados = filtrados.filter((grupo) =>
      (grupo.grupo || "")
        .toLowerCase()
        .includes(textoBusquedaGrupo.toLowerCase()),
    );
  }

  // Después de filtrar, se muestran los resultados
  mostrarGrupos(filtrados);
}

/* =========================================================
   MOSTRAR GRUPOS EN PANTALLA
   - Dibuja la tabla de grupos
========================================================= */

// Esta función recibe un arreglo de grupos y construye la tabla HTML
function mostrarGrupos(grupos) {
  // Referencia al contenedor donde se dibuja la tabla
  const listaGrupos = document.getElementById("listaGrupos");

  // Referencia al mensaje que aparece si no hay grupos
  const sinGrupos = document.getElementById("sinGrupos");

  // Si no hay grupos, se muestra el mensaje vacío y se limpia el contenedor
  if (!grupos || grupos.length === 0) {
    sinGrupos.style.display = "block";
    listaGrupos.innerHTML = "";
    return;
  }

  // Si sí hay grupos, se oculta el mensaje vacío
  sinGrupos.style.display = "none";

  // Se empieza a construir el HTML de la tabla
  let html = `
    <table class="table table-hover mt-3">
      <thead class="table-dark">
        <tr>
          <th>Grupo</th>
          <th>Tutor</th>
          <th>Total Alumnos</th>
          <th>Completaron (480h)</th>
          <th>Pendientes</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;

  // Se recorre cada grupo para crear una fila
  grupos.forEach((grupo) => {
    html += `
      <tr>
        <td>${grupo.grupo}</td>
        <td>${grupo.tutor || "Sin asignar"}</td>
        <td><span class="badge bg-primary">${grupo.total_alumnos}</span></td>
        <td><span class="badge bg-success">${grupo.completados || 0}</span></td>
        <td><span class="badge bg-warning text-dark">${grupo.no_completados || 0}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-info" onclick="verDetalles(${grupo.idgrupo})">
             👁️ Ver Detalles
          </button>
        </td>
      </tr>
    `;
  });

  // Se cierra la tabla
  html += `</tbody></table>`;

  // Se inserta todo el HTML en el contenedor
  listaGrupos.innerHTML = html;
}

/* =========================================================
   VER DETALLES DE UN GRUPO
   - Redirige a la vista de alumnos del grupo seleccionado
========================================================= */

// Esta función recibe el id del grupo y manda a la vista alumnos.html
// usando el id como parámetro en la URL
function verDetalles(id) {
  window.location.href = `alumnos.html?id=${id}`;
}

/* =========================================================
   FUNCIÓN GLOBAL
========================================================= */

// Se expone la función verDetalles al objeto global window
window.verDetalles = verDetalles;
