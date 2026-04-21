// =========================================================
// VALIDAR SESIÓN AL CARGAR LA PÁGINA
// =========================================================
(function validarSesion() {
  const usuario = localStorage.getItem("usuario"); // obtiene el nombre del usuario guardado en localStorage
  const rol = localStorage.getItem("rol")?.toLowerCase(); // obtiene el rol y lo pasa a minúsculas para evitar errores de comparación

  if (!usuario || !rol) {
    // si falta usuario o rol, significa que no hay sesión válida
    window.location.replace("/index.html"); // redirige al login
  }
})();

// =========================================================
// URLS DE LAS APIs
// =========================================================
const API_URL = "http://127.0.0.1:3000/api/actividad"; // endpoint principal para actividades
const API_URL_ASIGNACION = "http://127.0.0.1:3000/api/asignacion"; // endpoint para que el alumno se inscriba
const API_TAREAS = "http://127.0.0.1:3000/api/tareas"; // endpoint para consultar, crear, editar y eliminar tareas

// =========================================================
// VARIABLES GLOBALES DEL DOM
// =========================================================
let listaActividades; // contenedor donde se renderizan las actividades
let sinActividades; // mensaje que aparece cuando no hay actividades
let resumenProyectos; // contenedor del resumen del alumno
let contenedorFiltros; // contenedor de tarjetas de filtros por estatus

let modal; // modal de crear/editar actividad
let modalTareas; // modal que muestra las tareas de una actividad
let modalFormTarea; // modal de crear/editar tarea

let inputId; // id oculto de la actividad
let inputNombre; // input nombre de actividad
let inputDescripcion; // input descripción
let inputAlumnos; // input cupo o total de alumnos
let inputHoras; // input horas de actividad
let inputInicio; // input fecha inicio de actividad
let inputFin; // input fecha fin de actividad
let inputEstatus; // input/select estatus de actividad

let inputTareaId; // id oculto de la tarea
let inputNombreTarea; // input nombre de tarea
let inputHorasTarea; // input horas de tarea
let inputFechaInicioTarea; // input fecha inicio de tarea
let inputFechaFinTarea; // input fecha fin de tarea

let tituloModalActividad; // título visual del modal de actividad
let textoBtnGuardarProyecto; // texto del botón guardar/actualizar proyecto
let inputBuscar; // input de búsqueda por responsable
let inputFiltroHoras; // select de filtro por rango de horas
let contenedorBusquedaResponsable; // contenedor del buscador por responsable
let contenedorFiltroHorasAlumno; // contenedor del filtro de horas para alumno
let nombreActividadModal; // nombre de la actividad mostrado en modal de tareas
let infoHoras; // texto donde se muestran horas usadas y restantes
let tablaTareas; // tbody o contenedor de filas de tareas
let btnNuevaTarea; // botón para abrir modal de nueva tarea

// =========================================================
// VARIABLES DE ESTADO
// =========================================================
let rolActual = ""; // guarda el rol del usuario actual
let idActividadActual = null; // guarda la actividad actualmente seleccionada en el modal de tareas
let filtroEstatus = "Todos"; // filtro actual por estatus
let textoBusqueda = ""; // texto actual del buscador
let filtroHoras = "Todos"; // filtro actual de rango de horas
let actividadesOriginales = []; // copia original de actividades traídas del servidor
let tareasActuales = []; // tareas de la actividad que se está viendo en el modal

// =========================================================
// FUNCIÓN PARA GENERAR HEADERS DE FETCH
// =========================================================
function getHeaders() {
  return {
    "Content-Type": "application/json", // indica que el body se enviará en JSON
    Authorization: "Bearer " + localStorage.getItem("token"), // manda el token JWT para autenticar
  };
}

// =========================================================
// FUNCIÓN PARA CERRAR SESIÓN
// =========================================================
function cerrarSesion() {
  localStorage.removeItem("token"); // elimina token
  localStorage.removeItem("usuario"); // elimina usuario
  localStorage.removeItem("rol"); // elimina rol
  window.location.replace("/index.html"); // regresa al login
}

// =========================================================
// UTILIDADES GENERALES
// =========================================================
async function leerJSONSeguro(res) {
  const texto = await res.text(); // primero lee la respuesta como texto plano

  try {
    return texto ? JSON.parse(texto) : {}; // intenta convertir el texto a JSON; si viene vacío devuelve objeto vacío
  } catch (error) {
    console.error("La respuesta no vino en JSON válido:", texto); // muestra en consola la respuesta problemática
    return {}; // evita que truene el frontend si el backend respondió HTML o texto
  }
}

function escaparHTML(valor) {
  return String(valor ?? "") // convierte a string, y si viene null o undefined usa cadena vacía
    .replaceAll("&", "&amp;") // escapa &
    .replaceAll("<", "&lt;") // escapa <
    .replaceAll(">", "&gt;") // escapa >
    .replaceAll('"', "&quot;") // escapa comillas dobles
    .replaceAll("'", "&#39;"); // escapa comillas simples
}

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha"; // si no viene fecha, devuelve texto por defecto

  const soloFecha = String(fecha).includes("T") // revisa si la fecha viene en formato ISO con T
    ? String(fecha).split("T")[0] // si sí, toma solo la parte YYYY-MM-DD
    : String(fecha); // si no, deja el valor como está

  const partes = soloFecha.split("-"); // separa año, mes y día

  if (partes.length !== 3) return "Sin fecha"; // si no tiene formato esperado, devuelve texto por defecto

  const [anio, mes, dia] = partes; // desestructura año, mes y día
  return `${dia}/${mes}/${anio}`; // devuelve fecha en formato dd/mm/yyyy
}

function fechaInput(fecha) {
  if (!fecha) return ""; // si no hay fecha devuelve vacío para que el input no truene
  return String(fecha).includes("T")
    ? String(fecha).split("T")[0] // si viene fecha ISO, devuelve YYYY-MM-DD
    : String(fecha); // si no, devuelve tal cual
}

function obtenerClaseStatus(estatus) {
  if (estatus === "Activa") return "status-activa"; // clase CSS para activa
  if (estatus === "Pendiente") return "status-pendiente"; // clase CSS para pendiente
  if (estatus === "Cancelada") return "status-cancelada"; // clase CSS para cancelada
  return "status-finalizada"; // cualquier otro caso lo trata como finalizada
}

function obtenerClaseBarraProgreso(estatus, porcentaje) {
  if (estatus === "Cancelada") return "progreso-cancelada"; // barra especial para cancelada
  if (estatus === "Finalizada") return "progreso-finalizada"; // barra especial para finalizada
  if (estatus === "Pendiente") return "progreso-pendiente"; // barra especial para pendiente
  if (porcentaje >= 100) return "progreso-finalizada"; // si ya llegó al 100%, usa estilo de finalizada
  return "progreso-activa"; // en otro caso, se considera activa/en avance
}

function contarPorEstatus(actividades) {
  const conteo = {
    Todos: actividades.length, // total general
    Pendiente: 0, // contador de pendientes
    Activa: 0, // contador de activas
    Finalizada: 0, // contador de finalizadas
    Cancelada: 0, // contador de canceladas
  };

  actividades.forEach((act) => {
    if (conteo[act.estatus] !== undefined) {
      // solo suma si el estatus existe en el objeto
      conteo[act.estatus]++; // incrementa contador correspondiente
    }
  });

  return conteo; // regresa objeto con totales
}

function buscarActividadPorId(idactividad) {
  return actividadesOriginales.find(
    (act) => Number(act.idactividad) === Number(idactividad), // busca actividad por id convirtiendo ambos a número
  );
}

function buscarTareaPorId(idTarea) {
  return tareasActuales.find(
    (tarea) => Number(tarea.idTareas_Actividad) === Number(idTarea), // busca tarea actual por id
  );
}

// =========================================================
// VALIDAR RANGO DE HORAS
// =========================================================
function cumpleFiltroHoras(horasActividad) {
  const horas = Number(horasActividad || 0); // convierte horas a número seguro

  if (filtroHoras === "Todos") return true; // si no hay filtro, pasa todo
  if (filtroHoras === "1-100") return horas >= 1 && horas <= 100; // rango 1 a 100
  if (filtroHoras === "101-200") return horas >= 101 && horas <= 200; // rango 101 a 200
  if (filtroHoras === "201-300") return horas >= 201 && horas <= 300; // rango 201 a 300
  if (filtroHoras === "301-480") return horas >= 301 && horas <= 480; // rango 301 a 480

  return true; // por seguridad, si llega un valor no contemplado, deja pasar
}

// =========================================================
// INICIO DE LA PÁGINA
// =========================================================
window.addEventListener("load", () => {
  listaActividades = document.getElementById("listaActividades"); // obtiene contenedor principal de actividades
  sinActividades = document.getElementById("sinActividades"); // obtiene mensaje de "sin actividades"
  resumenProyectos = document.getElementById("resumenProyectos"); // obtiene contenedor del resumen
  contenedorFiltros = document.getElementById("contenedorFiltros"); // obtiene contenedor de filtros

  inputId = document.getElementById("actividadId"); // input oculto del id de actividad
  inputNombre = document.getElementById("nombreActividad"); // input nombre
  inputDescripcion = document.getElementById("descripcion"); // input descripción
  inputHoras = document.getElementById("horas"); // input horas
  inputAlumnos = document.getElementById("totalAlumnos"); // input cupo
  inputInicio = document.getElementById("fechaInicio"); // input fecha inicio
  inputFin = document.getElementById("fechaFin"); // input fecha fin
  inputEstatus = document.getElementById("editEstatus"); // select/input de estatus

  inputTareaId = document.getElementById("tareaId"); // input oculto id tarea
  inputNombreTarea = document.getElementById("nombreTarea"); // input nombre tarea
  inputHorasTarea = document.getElementById("horasTarea"); // input horas tarea
  inputFechaInicioTarea = document.getElementById("fechaInicioTarea"); // input fecha inicio tarea
  inputFechaFinTarea = document.getElementById("fechaFinTarea"); // input fecha fin tarea

  tituloModalActividad = document.getElementById("tituloModalActividad"); // título del modal actividad
  textoBtnGuardarProyecto = document.getElementById("textoBtnGuardarProyecto"); // span/texto del botón guardar

  inputBuscar = document.getElementById("buscarResponsable"); // input para buscar por responsable
  inputFiltroHoras = document.getElementById("filtroHoras"); // select de filtro de horas
  contenedorBusquedaResponsable = document.getElementById(
    "contenedorBusquedaResponsable", // contenedor del buscador
  );
  contenedorFiltroHorasAlumno = document.getElementById(
    "contenedorFiltroHorasAlumno", // contenedor del filtro de horas del alumno
  );

  nombreActividadModal = document.getElementById("nombreActividadModal"); // nombre de la actividad dentro del modal de tareas
  infoHoras = document.getElementById("infoHoras"); // texto de horas usadas/restantes
  tablaTareas = document.getElementById("tablaTareas"); // cuerpo de tabla de tareas
  btnNuevaTarea = document.getElementById("btnNuevaTarea"); // botón nueva tarea

  modal = new bootstrap.Modal(document.getElementById("modalActividad")); // crea instancia bootstrap del modal de actividad
  modalTareas = new bootstrap.Modal(document.getElementById("modalTareas")); // crea instancia bootstrap del modal de tareas
  modalFormTarea = new bootstrap.Modal(
    document.getElementById("modalFormTarea"), // crea instancia bootstrap del modal del formulario de tarea
  );

  rolActual = localStorage.getItem("rol")?.toLowerCase() || ""; // obtiene rol actual desde localStorage

  configurarVistaSegunRol(); // ajusta qué se muestra según rol

  if (inputBuscar) {
    inputBuscar.addEventListener("input", (e) => {
      textoBusqueda = e.target.value; // actualiza el texto a buscar
      aplicarFiltros(); // vuelve a filtrar y renderizar
    });
  }

  if (inputFiltroHoras) {
    inputFiltroHoras.addEventListener("change", (e) => {
      filtroHoras = e.target.value; // actualiza filtro de horas
      aplicarFiltros(); // vuelve a aplicar filtros
    });
  }

  document
    .getElementById("formActividad")
    .addEventListener("submit", guardarActividad); // al enviar el form de actividad, ejecuta guardarActividad
  document.getElementById("formTarea").addEventListener("submit", guardarTarea); // al enviar el form de tarea, ejecuta guardarTarea

  cargarActividades(); // al cargar la página, trae actividades desde backend
});

// =========================================================
// CONFIGURAR VISTA SEGÚN ROL
// =========================================================
function configurarVistaSegunRol() {
  const btnNuevo = document.getElementById("btnNuevaActividad"); // botón para nueva actividad

  if (rolActual !== "responsable" && btnNuevo) {
    // si no es responsable
    btnNuevo.style.display = "none"; // oculta botón de crear
  }

  if (rolActual === "responsable") {
    if (contenedorBusquedaResponsable) {
      contenedorBusquedaResponsable.style.display = "none"; // al responsable no le sale buscar por responsable
    }
  } else {
    if (contenedorBusquedaResponsable) {
      contenedorBusquedaResponsable.style.display = "block"; // a otros roles sí se les muestra
    }
  }

  if (rolActual === "alumno") {
    if (contenedorFiltroHorasAlumno) {
      contenedorFiltroHorasAlumno.style.display = "block"; // al alumno sí se le muestra filtro por horas
    }
  } else {
    if (contenedorFiltroHorasAlumno) {
      contenedorFiltroHorasAlumno.style.display = "none"; // a los demás no
    }
  }

  if (rolActual !== "responsable" && filtroEstatus === "Pendiente") {
    // si no es responsable y el filtro estaba en pendiente
    filtroEstatus = "Todos"; // lo regresa a Todos porque solo responsable ve pendientes
  }
}

// =========================================================
// CARGAR ACTIVIDADES DESDE LA API
// =========================================================
async function cargarActividades() {
  try {
    const res = await fetch(API_URL, {
      headers: getHeaders(), // manda token en headers
    });

    if (res.status === 401) {
      // si el token ya no sirve
      cerrarSesion(); // fuerza logout
      return;
    }

    const data = await leerJSONSeguro(res); // intenta leer la respuesta como JSON

    if (!res.ok) {
      // si el backend respondió error
      console.error("Error en el servidor al cargar actividades:", data); // muestra detalle en consola
      alert(data.msg || "No se pudieron cargar los proyectos."); // muestra mensaje al usuario
      return;
    }

    if (data?.sinPeriodo) {
      // caso especial para alumno sin periodo definido en su grupo
      actividadesOriginales = []; // limpia actividades
      alert(
        data.msg ||
          "Tu grupo aún no tiene definido su periodo de servicio social.", // mensaje al alumno
      );
      aplicarFiltros(); // renderiza vista vacía
      return;
    }

    actividadesOriginales = Array.isArray(data) ? data : []; // guarda actividades si la respuesta es un arreglo
    aplicarFiltros(); // filtra y muestra
  } catch (error) {
    console.error("Error al cargar actividades:", error); // error de red o fetch
    alert("Error de conexión con el servidor."); // mensaje al usuario
  }
}

// =========================================================
// RENDERIZAR RESUMEN
// =========================================================
function renderizarResumen(actividadesBase) {
  const total = actividadesBase.length; // total de actividades visibles después de búsqueda/filtro base

  if (rolActual !== "alumno") {
    // solo alumno ve resumen
    resumenProyectos.innerHTML = ""; // limpia contenido
    resumenProyectos.style.display = "none"; // oculta contenedor
    return;
  }

  resumenProyectos.style.display = "block"; // muestra contenedor
  resumenProyectos.innerHTML = `
    <div class="resumen-card">
      <div class="resumen-label">Total de proyectos</div>
      <div class="resumen-value">${total}</div>
    </div>
  `; // inserta tarjeta con total de proyectos
}

// =========================================================
// RENDERIZAR FILTROS
// =========================================================
function renderizarFiltros(actividadesBase) {
  if (rolActual === "alumno") {
    // el alumno no usa filtros por estatus con tarjetas
    contenedorFiltros.innerHTML = ""; // limpia
    return;
  }

  const conteo = contarPorEstatus(actividadesBase); // cuenta actividades según estatus

  const filtros = [
    {
      estatus: "Todos", // filtro general
      etiqueta: "Todos", // texto visible
      cantidad: conteo.Todos, // cantidad
      clase: "filtro-todos", // clase CSS
    },
  ];

  if (rolActual === "responsable") {
    // solo responsable ve pendientes
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
  ); // agrega filtros comunes para todos menos alumno

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
    .join(""); // genera todo el HTML de filtros y lo inserta
}

// =========================================================
// APLICAR FILTROS
// =========================================================
function aplicarFiltros() {
  let actividadesBase = [...actividadesOriginales]; // crea copia para no modificar el arreglo original

  if (textoBusqueda.trim() !== "") {
    // si hay texto en buscador
    actividadesBase = actividadesBase.filter(
      (act) =>
        String(act.nombre_responsable || "") // toma nombre del responsable
          .toLowerCase() // lo pasa a minúsculas
          .includes(textoBusqueda.toLowerCase()), // compara contra texto ingresado
    );
  }

  if (rolActual === "alumno") {
    // solo alumno usa filtro por rango de horas
    actividadesBase = actividadesBase.filter(
      (act) => cumpleFiltroHoras(act.horas_actividad), // deja pasar solo actividades del rango elegido
    );
  }

  renderizarResumen(actividadesBase); // renderiza resumen según actividades base
  renderizarFiltros(actividadesBase); // renderiza filtros con conteos de actividades base

  let filtradas = [...actividadesBase]; // copia para aplicar filtro de estatus

  if (filtroEstatus !== "Todos") {
    // si hay filtro por estatus activo
    filtradas = filtradas.filter((act) => act.estatus === filtroEstatus); // deja solo las del estatus elegido
  }

  mostrarActividades(filtradas); // pinta resultado final
}

// =========================================================
// CAMBIAR FILTRO DE ESTATUS
// =========================================================
function cambiarFiltro(estatus) {
  filtroEstatus = estatus; // actualiza el estatus seleccionado
  aplicarFiltros(); // vuelve a pintar la vista
}

// =========================================================
// MOSTRAR ACTIVIDADES EN PANTALLA
// =========================================================
function mostrarActividades(actividades) {
  listaActividades.innerHTML = ""; // limpia el contenedor antes de volver a renderizar

  if (!actividades.length) {
    // si no hay actividades
    sinActividades.style.display = "block"; // muestra mensaje de vacío
    return;
  }

  sinActividades.style.display = "none"; // oculta mensaje si sí hay actividades

  actividades.forEach((act) => {
    const inscritos = Number(act.inscritos || 0); // convierte inscritos a número
    const cupo = Number(act.totalAlumnosRequeridos || 0); // convierte cupo a número
    const estatus = act.estatus || "Finalizada"; // toma estatus o pone finalizada por defecto
    const statusClass = obtenerClaseStatus(estatus); // obtiene clase CSS del estatus

    const horasProyecto = Number(act.horas_actividad || 0); // total de horas del proyecto
    const horasCumplidas = Number(act.horas_cumplidas || 0); // horas cumplidas registradas
    const porcentajeAvance = Number(act.porcentaje_avance || 0); // porcentaje calculado por backend
    const claseBarra = obtenerClaseBarraProgreso(estatus, porcentajeAvance); // clase visual de barra de progreso

    const hayCupo = inscritos < cupo; // true si aún hay espacio
    const estaActiva = estatus === "Activa"; // true si actividad está activa
    const yaInscrito = Number(act.inscrito) === 1 || act.inscrito === true; // revisa si el alumno actual ya está inscrito

    const claseFila = yaInscrito
      ? "actividad-row actividad-inscrita" // si ya está inscrito, agrega clase visual especial
      : "actividad-row"; // si no, usa clase normal

    let accionesHTML = `
      <button class="btn-tabla btn-ver" onclick="verTareas(${Number(act.idactividad)})">
        Tareas
      </button>
    `; // siempre agrega botón para ver tareas

    if (rolActual === "alumno") {
      // lógica especial de botón de inscripción para alumno
      let textoBoton = "Inscribirse"; // texto por defecto
      let claseBoton = "btn-unirme"; // clase por defecto
      let deshabilitado = ""; // atributo disabled por defecto vacío

      if (yaInscrito) {
        textoBoton = "Inscrito"; // si ya está inscrito cambia texto
        claseBoton = "btn-inscrito"; // cambia estilo
        deshabilitado = "disabled"; // desactiva botón
      } else if (!estaActiva) {
        textoBoton = "No disponible"; // si no está activa, no permite inscripción
        claseBoton = "btn-no-disponible";
        deshabilitado = "disabled";
      } else if (!hayCupo) {
        textoBoton = "Cupo lleno"; // si ya no hay cupo, no permite inscripción
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
      `; // agrega botón de inscripción según condición
    }

    if (rolActual === "responsable") {
      // si es responsable, agrega botones de edición y borrado/cancelación
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
      rolActual === "responsable" || rolActual === "director"; // solo responsable y director ven barra de progreso del proyecto

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
      : ""; // si corresponde, genera HTML de barra de progreso

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
    `; // inserta tarjeta/fila completa de actividad
  });
}

// =========================================================
// ABRIR MODAL PARA NUEVO PROYECTO
// =========================================================
function abrirNuevo() {
  inputId.value = ""; // limpia id para indicar que será nuevo registro
  inputNombre.value = ""; // limpia nombre
  inputDescripcion.value = ""; // limpia descripción
  inputHoras.value = ""; // limpia horas
  inputAlumnos.value = ""; // limpia alumnos requeridos
  inputInicio.value = ""; // limpia fecha inicio
  inputFin.value = ""; // limpia fecha fin

  if (inputEstatus) {
    inputEstatus.value = "Pendiente"; // por defecto en alta se deja pendiente
  }

  if (document.getElementById("contenedorEstatus")) {
    document.getElementById("contenedorEstatus").style.display = "none"; // en nuevo proyecto se oculta selector de estatus
  }

  if (tituloModalActividad) {
    tituloModalActividad.textContent = "Nuevo Proyecto"; // cambia título del modal
  }

  if (textoBtnGuardarProyecto) {
    textoBtnGuardarProyecto.textContent = "Guardar Proyecto"; // cambia texto del botón
  }

  modal.show(); // abre modal
}

// =========================================================
// EDITAR ACTIVIDAD
// =========================================================
function editarActividad(idactividad) {
  const act = buscarActividadPorId(idactividad); // busca actividad en el arreglo actual

  if (!act) {
    alert("No se encontró la actividad a editar."); // si no la encuentra, avisa
    return;
  }

  inputId.value = act.idactividad; // carga id en input oculto
  inputNombre.value = act.nombreActividad || ""; // carga nombre
  inputDescripcion.value = act.descripcion || ""; // carga descripción
  inputHoras.value = act.horas_actividad || ""; // carga horas
  inputAlumnos.value = act.totalAlumnosRequeridos || ""; // carga cupo
  inputInicio.value = fechaInput(act.fecha_alta); // carga fecha inicio en formato para input date
  inputFin.value = fechaInput(act.fechaTermino); // carga fecha fin en formato para input date

  if (inputEstatus) {
    inputEstatus.value = act.estatus || "Pendiente"; // carga estatus actual
  }

  if (document.getElementById("contenedorEstatus")) {
    document.getElementById("contenedorEstatus").style.display = "block"; // en edición sí se muestra selector de estatus
  }

  if (tituloModalActividad) {
    tituloModalActividad.textContent = "Editar Proyecto"; // cambia título
  }

  if (textoBtnGuardarProyecto) {
    textoBtnGuardarProyecto.textContent = "Actualizar Proyecto"; // cambia texto del botón
  }

  modal.show(); // abre modal
}

// =========================================================
// GUARDAR ACTIVIDAD
// =========================================================
async function guardarActividad(e) {
  e.preventDefault(); // evita que el form recargue la página

  if (inputFin.value < inputInicio.value) {
    // validación rápida en frontend
    alert("La fecha de término no puede ser menor que la fecha de inicio.");
    return;
  }

  const data = {
    nombreActividad: inputNombre.value.trim(), // nombre limpio sin espacios extra
    descripcion: inputDescripcion.value.trim(), // descripción limpia
    horas_actividad: Number(inputHoras.value), // horas convertidas a número
    fecha_alta: inputInicio.value, // fecha inicio
    fechaTermino: inputFin.value, // fecha fin
    totalAlumnosRequeridos: Number(inputAlumnos.value), // cupo convertido a número
    estatus: inputEstatus.value, // estatus actual
  };

  try {
    const id = inputId.value; // si hay id, se trata de edición
    const url = id ? `${API_URL}/${id}` : API_URL; // si hay id usa PUT a /api/actividad/:id, si no usa POST a /api/actividad
    const method = id ? "PUT" : "POST"; // decide método HTTP

    const res = await fetch(url, {
      method, // POST o PUT
      headers: getHeaders(), // token y content-type
      body: JSON.stringify(data), // manda body en JSON
    });

    if (res.status === 401) {
      cerrarSesion(); // si el token expiró, cierra sesión
      return;
    }

    const respuesta = await leerJSONSeguro(res); // intenta leer respuesta

    if (!res.ok) {
      alert(respuesta.msg || "Error al guardar el proyecto."); // muestra mensaje de error del backend
      return;
    }

    modal.hide(); // cierra modal si se guardó bien
    cargarActividades(); // recarga actividades para refrescar vista
  } catch (error) {
    console.error("Error al guardar actividad:", error); // error de red o fetch
    alert("Error de conexión con el servidor.");
  }
}

// =========================================================
// ELIMINAR / CANCELAR ACTIVIDAD
// =========================================================
async function eliminarActividad(idactividad) {
  if (!confirm("¿Seguro que quieres CANCELAR este proyecto?")) {
    // pide confirmación
    return;
  }

  try {
    const res = await fetch(`${API_URL}/${idactividad}`, {
      method: "DELETE", // usa DELETE, aunque backend realmente cancela en lugar de borrar físico
      headers: getHeaders(), // manda token
    });

    if (res.status === 401) {
      cerrarSesion(); // sesión inválida
      return;
    }

    const respuesta = await leerJSONSeguro(res); // lee respuesta segura

    if (!res.ok) {
      alert(respuesta.msg || "No se pudo cancelar el proyecto."); // mensaje si hubo error
      return;
    }

    cargarActividades(); // recarga la lista actualizada
  } catch (error) {
    console.error("Error al cancelar actividad:", error); // error general
    alert("Error de conexión con el servidor.");
  }
}

// =========================================================
// INSCRIPCIÓN DEL ALUMNO A UNA ACTIVIDAD
// =========================================================
async function unirme(idactividad) {
  if (!confirm("¿Estás seguro de que deseas inscribirte en esta actividad?")) {
    // confirmación antes de inscribirse
    return;
  }

  try {
    const res = await fetch(API_URL_ASIGNACION, {
      method: "POST", // crea nueva asignación
      headers: getHeaders(), // token + content-type
      body: JSON.stringify({ idactividad }), // manda id de actividad en body
    });

    if (res.status === 401) {
      cerrarSesion(); // token inválido
      return;
    }

    const data = await leerJSONSeguro(res); // lee respuesta

    if (!res.ok) {
      const msg = String(data.msg || "").toLowerCase(); // toma mensaje del backend y lo normaliza

      if (msg.includes("480") || msg.includes("horas")) {
        alert("No puedes unirte: superarías el límite de 480 horas."); // caso límite de horas
      } else if (msg.includes("llena") || msg.includes("cupo")) {
        alert("Esta actividad ya alcanzó su cupo máximo."); // caso cupo lleno
      } else if (msg.includes("inscrito")) {
        alert("Ya te encuentras inscrito en esta actividad."); // caso ya inscrito
      } else {
        alert(data.msg || "Hubo un error al procesar tu inscripción."); // otro error general
      }

      return;
    }

    alert("¡Inscripción exitosa! Ahora eres parte de esta actividad."); // mensaje de éxito
    cargarActividades(); // refresca lista para que cambie estado a inscrito
  } catch (error) {
    console.error("Error en unirme:", error); // error de red
    alert("Error de conexión con el servidor.");
  }
}

// =========================================================
// VER TAREAS DE UNA ACTIVIDAD
// =========================================================
async function verTareas(idactividad) {
  idActividadActual = idactividad; // guarda id de actividad en variable global para usarlo en crear/editar tarea

  const actividadActual = buscarActividadPorId(idactividad); // busca datos de la actividad en memoria

  if (!actividadActual) {
    alert("No se encontró la actividad seleccionada."); // si no la encuentra, avisa
    return;
  }

  try {
    nombreActividadModal.textContent = actividadActual.nombreActividad || ""; // coloca nombre de actividad en el modal

    const res = await fetch(`${API_TAREAS}/${idactividad}`, {
      headers: getHeaders(), // consulta tareas de la actividad
    });

    if (res.status === 401) {
      cerrarSesion(); // sesión expirada
      return;
    }

    const data = await leerJSONSeguro(res); // lee JSON seguro

    if (!res.ok) {
      alert(data.msg || "No se pudieron cargar las tareas."); // error si backend no respondió ok
      return;
    }

    tareasActuales = Array.isArray(data) ? data : []; // guarda tareas en variable global

    let totalHorasUsadas = 0; // acumulador de horas ya usadas en tareas
    let html = ""; // aquí se irá armando el tbody de tareas

    tareasActuales.forEach((tarea) => {
      totalHorasUsadas += Number(tarea.horas_Tareas || 0); // suma horas de cada tarea

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
      `; // crea fila de tarea; responsable ve editar/eliminar, otros solo lectura
    });

    if (!tareasActuales.length) {
      html = `
        <tr>
          <td colspan="5" class="text-center text-muted">
            No hay tareas registradas para este proyecto.
          </td>
        </tr>
      `; // si no hay tareas, muestra fila informativa
    }

    tablaTareas.innerHTML = html; // inserta filas en la tabla

    const totalActividad = Number(actividadActual.horas_actividad || 0); // toma horas totales del proyecto
    const restantes = totalActividad - totalHorasUsadas; // calcula horas restantes por asignar

    if (rolActual === "responsable") {
      btnNuevaTarea.style.display = "inline-block"; // responsable sí ve botón
      btnNuevaTarea.disabled = restantes <= 0; // si ya no hay horas disponibles, desactiva botón
      btnNuevaTarea.textContent =
        restantes <= 0 ? "Horas completas" : "+ Nueva tarea"; // cambia texto del botón
    } else {
      btnNuevaTarea.style.display = "none"; // otros roles no ven botón de nueva tarea
    }

    infoHoras.textContent = `Horas usadas: ${totalHorasUsadas} / ${totalActividad} | Restantes: ${restantes}`; // muestra resumen de horas
    infoHoras.className =
      restantes < 0 ? "mt-2 fw-bold text-danger" : "mt-2 fw-bold text-success"; // cambia color según si ya se pasó o no

    modalTareas.show(); // abre modal de tareas
  } catch (error) {
    console.error("Error al ver tareas:", error); // error general
    alert("Error de conexión con el servidor.");
  }
}

// =========================================================
// ABRIR FORMULARIO PARA NUEVA TAREA
// =========================================================
function abrirNuevaTarea() {
  if (rolActual !== "responsable") {
    // seguridad extra en frontend
    alert("No tienes permisos.");
    return;
  }

  inputTareaId.value = ""; // limpia id para indicar nueva tarea
  inputNombreTarea.value = ""; // limpia nombre
  inputHorasTarea.value = ""; // limpia horas
  inputFechaInicioTarea.value = ""; // limpia fecha inicio
  inputFechaFinTarea.value = ""; // limpia fecha fin

  const actividadActual = buscarActividadPorId(idActividadActual); // busca actividad seleccionada

  if (actividadActual) {
    const fechaProyectoInicio = fechaInput(actividadActual.fecha_alta); // fecha inicio proyecto en formato input
    const fechaProyectoFin = fechaInput(actividadActual.fechaTermino); // fecha fin proyecto en formato input

    inputFechaInicioTarea.min = fechaProyectoInicio; // limita fecha mínima al inicio del proyecto
    inputFechaInicioTarea.max = fechaProyectoFin; // limita fecha máxima al fin del proyecto
    inputFechaFinTarea.min = fechaProyectoInicio; // limita fecha mínima al inicio del proyecto
    inputFechaFinTarea.max = fechaProyectoFin; // limita fecha máxima al fin del proyecto
  }

  modalFormTarea.show(); // abre modal de formulario de tarea
}

// =========================================================
// EDITAR TAREA
// =========================================================
function editarTarea(idTarea) {
  const tarea = buscarTareaPorId(idTarea); // busca la tarea en el arreglo actual

  if (!tarea) {
    alert("No se encontró la tarea."); // si no la encuentra, avisa
    return;
  }

  inputTareaId.value = tarea.idTareas_Actividad; // carga id de tarea
  inputNombreTarea.value = tarea.nombre_tarea || ""; // carga nombre
  inputHorasTarea.value = tarea.horas_Tareas || ""; // carga horas
  inputFechaInicioTarea.value = fechaInput(tarea.fechaInicio); // carga fecha inicio
  inputFechaFinTarea.value = fechaInput(tarea.fechaFin); // carga fecha fin

  const actividadActual = buscarActividadPorId(idActividadActual); // busca actividad actual

  if (actividadActual) {
    const fechaProyectoInicio = fechaInput(actividadActual.fecha_alta); // fecha mínima permitida
    const fechaProyectoFin = fechaInput(actividadActual.fechaTermino); // fecha máxima permitida

    inputFechaInicioTarea.min = fechaProyectoInicio; // restringe input
    inputFechaInicioTarea.max = fechaProyectoFin;
    inputFechaFinTarea.min = fechaProyectoInicio;
    inputFechaFinTarea.max = fechaProyectoFin;
  }

  modalFormTarea.show(); // abre modal con datos cargados
}

// =========================================================
// GUARDAR TAREA
// =========================================================
async function guardarTarea(e) {
  e.preventDefault(); // evita recarga del formulario

  if (inputFechaFinTarea.value < inputFechaInicioTarea.value) {
    // validación básica de fechas
    alert("La fecha de fin no puede ser menor que la fecha de inicio.");
    return;
  }

  const actividadActual = buscarActividadPorId(idActividadActual); // obtiene actividad actual para validar rango de proyecto

  if (actividadActual) {
    const fechaProyectoInicio = fechaInput(actividadActual.fecha_alta); // inicio de proyecto
    const fechaProyectoFin = fechaInput(actividadActual.fechaTermino); // fin de proyecto

    if (
      inputFechaInicioTarea.value < fechaProyectoInicio || // si tarea inicia antes del proyecto
      inputFechaFinTarea.value > fechaProyectoFin // o termina después del proyecto
    ) {
      alert(
        `La tarea debe estar dentro del rango del proyecto: ${fechaProyectoInicio} a ${fechaProyectoFin}`, // avisa rango válido
      );
      return;
    }
  }

  const id = inputTareaId.value; // si hay id, es edición

  const data = {
    idactividad: idActividadActual, // actividad a la que pertenece
    nombre_tarea: inputNombreTarea.value.trim(), // nombre de tarea limpio
    horas_Tareas: Number(inputHorasTarea.value), // horas convertidas a número
    fechaInicio: inputFechaInicioTarea.value, // fecha inicio
    fechaFin: inputFechaFinTarea.value, // fecha fin
  };

  try {
    const url = id ? `${API_TAREAS}/${id}` : API_TAREAS; // si hay id usa PUT, si no POST
    const method = id ? "PUT" : "POST"; // método correspondiente

    const res = await fetch(url, {
      method, // PUT o POST
      headers: getHeaders(), // token y content-type
      body: JSON.stringify(data), // body JSON
    });

    if (res.status === 401) {
      cerrarSesion(); // token inválido
      return;
    }

    const respuesta = await leerJSONSeguro(res); // lee respuesta

    if (!res.ok) {
      alert(respuesta.msg || "Error al guardar la tarea."); // error desde backend
      return;
    }

    modalFormTarea.hide(); // cierra modal de tarea
    verTareas(idActividadActual); // recarga tareas de la actividad para actualizar tabla
  } catch (error) {
    console.error("Error al guardar tarea:", error); // error de red
    alert("Error de conexión con el servidor.");
  }
}

// =========================================================
// ELIMINAR TAREA
// =========================================================
async function eliminarTarea(idTarea) {
  if (!confirm("¿Seguro que deseas eliminar esta tarea?")) {
    // confirmación antes de borrar
    return;
  }

  try {
    const res = await fetch(`${API_TAREAS}/${idTarea}`, {
      method: "DELETE", // elimina tarea
      headers: getHeaders(), // token
    });

    if (res.status === 401) {
      cerrarSesion(); // sesión inválida
      return;
    }

    const respuesta = await leerJSONSeguro(res); // lee respuesta

    if (!res.ok) {
      alert(respuesta.msg || "No se pudo eliminar la tarea."); // avisa si hubo error
      return;
    }

    verTareas(idActividadActual); // vuelve a cargar tareas de la actividad actual
  } catch (error) {
    console.error("Error al eliminar tarea:", error); // error de red
    alert("Error de conexión con el servidor.");
  }
}

// =========================================================
// EXPONER FUNCIONES GLOBALES
// =========================================================
window.abrirNuevo = abrirNuevo; // expone función para botón nuevo proyecto
window.cambiarFiltro = cambiarFiltro; // expone función para botones de filtro
window.verTareas = verTareas; // expone función para botón ver tareas
window.abrirNuevaTarea = abrirNuevaTarea; // expone función para botón nueva tarea
window.editarActividad = editarActividad; // expone función de editar actividad
window.eliminarActividad = eliminarActividad; // expone función de cancelar actividad
window.editarTarea = editarTarea; // expone función de editar tarea
window.eliminarTarea = eliminarTarea; // expone función de eliminar tarea
window.unirme = unirme; // expone función de inscripción del alumno
