// =========================================================
// VALIDAR SESIÓN Y PERMISOS DE ADMINISTRADOR
// =========================================================
(function validarSesionAdminGrupos() {
  const usuario = localStorage.getItem("usuario"); // obtiene el usuario guardado en localStorage
  const rol = localStorage.getItem("rol")?.toLowerCase(); // obtiene el rol y lo pasa a minúsculas

  if (!usuario || !rol) {
    // si no hay usuario o rol, no hay sesión válida
    window.location.replace("/index.html"); // redirige al login
    return;
  }

  if (rol !== "administrador") {
    // si el rol no es administrador, bloquea acceso
    alert("No tienes permisos para entrar a Gestión de Grupos."); // avisa al usuario
    window.location.replace("/html/portada.html"); // lo manda a portada
  }
})();

// =========================================================
// ENDPOINTS
// =========================================================
const API_GRUPOS = "http://127.0.0.1:3000/api/admin/grupos"; // endpoint para obtener y actualizar grupos
const API_TUTORES = "http://127.0.0.1:3000/api/admin/tutores"; // endpoint para obtener tutores activos

// =========================================================
// VARIABLES GLOBALES
// =========================================================
let gruposOriginales = []; // arreglo base con todos los grupos cargados desde el servidor
let tutoresDisponibles = []; // arreglo con tutores disponibles para el select
let modalGrupo = null; // referencia a la instancia Bootstrap del modal de grupos

// =========================================================
// REFERENCIAS DEL DOM
// =========================================================
const listaGruposAdmin = document.getElementById("listaGruposAdmin"); // tbody o contenedor donde se renderizan los grupos
const alertaGrupos = document.getElementById("alertaGrupos"); // alerta principal de la pantalla
const alertaGrupoModal = document.getElementById("alertaGrupoModal"); // alerta interna del modal

const totalGrupos = document.getElementById("totalGrupos"); // tarjeta/resumen del total de grupos
const gruposConTutor = document.getElementById("gruposConTutor"); // tarjeta/resumen de grupos con tutor
const gruposConPeriodo = document.getElementById("gruposConPeriodo"); // tarjeta/resumen de grupos con periodo definido

const buscarGrupo = document.getElementById("buscarGrupo"); // input de búsqueda por nombre o turno
const filtroCuatrimestre = document.getElementById("filtroCuatrimestre"); // select de filtro por cuatrimestre
const filtroTutor = document.getElementById("filtroTutor"); // select para filtrar con tutor o sin tutor
const btnLimpiarFiltrosGrupos = document.getElementById(
  "btnLimpiarFiltrosGrupos", // botón para limpiar filtros
);

// Modal
const formGrupo = document.getElementById("formGrupo"); // formulario dentro del modal
const grupoId = document.getElementById("grupoId"); // input oculto o de lectura con id del grupo
const grupoNombre = document.getElementById("grupoNombre"); // input o campo del nombre del grupo
const grupoTurno = document.getElementById("grupoTurno"); // select/input del turno
const grupoCuatrimestre = document.getElementById("grupoCuatrimestre"); // campo del cuatrimestre
const selectTutorGrupo = document.getElementById("selectTutorGrupo"); // select de tutores
const fechaInicioServicioGrupo = document.getElementById(
  "fechaInicioServicioGrupo", // input de fecha de inicio de servicio
);
const fechaTerminoServicioGrupo = document.getElementById(
  "fechaTerminoServicioGrupo", // input de fecha de término de servicio
);

// =========================================================
// HEADERS
// =========================================================
function getHeaders() {
  return {
    "Content-Type": "application/json", // indica que el body irá en JSON
    Authorization: "Bearer " + localStorage.getItem("token"), // manda el token JWT para autenticación
  };
}

// =========================================================
// UTILIDADES
// =========================================================
function escaparHTML(valor) {
  return String(valor ?? "") // convierte a texto y evita null/undefined
    .replaceAll("&", "&amp;") // escapa &
    .replaceAll("<", "&lt;") // escapa <
    .replaceAll(">", "&gt;") // escapa >
    .replaceAll('"', "&quot;") // escapa comillas dobles
    .replaceAll("'", "&#39;"); // escapa comillas simples
}

function formatearFecha(fecha) {
  if (!fecha) return ""; // si no hay fecha devuelve vacío

  const fechaLimpia = String(fecha).split("T")[0]; // si la fecha viene como ISO, toma solo YYYY-MM-DD
  const partes = fechaLimpia.split("-"); // separa año, mes y día

  if (partes.length !== 3) return fechaLimpia; // si no tiene el formato esperado, regresa la fecha tal cual

  return `${partes[2]}/${partes[1]}/${partes[0]}`; // convierte a formato dd/mm/yyyy
}

function normalizarFechaInput(fecha) {
  if (!fecha) return ""; // si no hay fecha, devuelve vacío para el input
  return String(fecha).split("T")[0]; // deja la fecha en formato YYYY-MM-DD
}

function obtenerBadgeTutor(grupo) {
  if (!grupo.nombre_tutor) {
    // si no hay tutor asignado
    return `<span class="badge-tutor badge-tutor-sin">Sin tutor</span>`; // devuelve badge visual de sin tutor
  }

  const estatusTutor = String(grupo.estatus_tutor || "activo").toLowerCase(); // toma el estatus del tutor y lo normaliza

  if (estatusTutor === "inactivo") {
    // si el tutor está inactivo
    return `
      <div class="d-flex flex-column gap-1">
        <span class="badge-tutor badge-tutor-inactivo">${escaparHTML(grupo.nombre_tutor)}</span>
        <small class="text-danger fw-semibold">Tutor inactivo</small>
      </div>
    `; // muestra nombre y leyenda de inactivo
  }

  if (estatusTutor === "baja_temporal") {
    // si el tutor tiene baja temporal
    return `
      <div class="d-flex flex-column gap-1">
        <span class="badge-tutor badge-tutor-baja">${escaparHTML(grupo.nombre_tutor)}</span>
        <small class="text-warning fw-semibold">Baja temporal</small>
      </div>
    `; // muestra nombre y leyenda de baja temporal
  }

  return `<span class="badge-tutor badge-tutor-asignado">${escaparHTML(grupo.nombre_tutor)}</span>`; // si está activo, muestra badge normal
}

// =========================================================
// ALERTAS
// =========================================================
function mostrarAlerta(mensaje, tipo = "success") {
  if (!alertaGrupos) return; // si no existe el contenedor, sale de la función

  alertaGrupos.className = `alert alert-${tipo}`; // asigna clases Bootstrap según el tipo
  alertaGrupos.textContent = mensaje; // coloca el texto del mensaje
  alertaGrupos.classList.remove("d-none"); // hace visible la alerta
}

function ocultarAlerta() {
  if (!alertaGrupos) return; // si no existe, no hace nada

  alertaGrupos.className = "alert d-none"; // oculta la alerta
  alertaGrupos.textContent = ""; // limpia el texto
}

function mostrarAlertaModal(mensaje, tipo = "danger") {
  if (!alertaGrupoModal) return; // valida que exista la alerta del modal

  alertaGrupoModal.className = `alert alert-${tipo}`; // asigna tipo de alerta
  alertaGrupoModal.textContent = mensaje; // coloca mensaje
  alertaGrupoModal.classList.remove("d-none"); // la muestra
}

function ocultarAlertaModal() {
  if (!alertaGrupoModal) return; // valida existencia

  alertaGrupoModal.className = "alert d-none"; // oculta la alerta
  alertaGrupoModal.textContent = ""; // limpia el texto
}

// =========================================================
// RESUMEN
// =========================================================
function actualizarResumen(grupos) {
  const total = grupos.length; // total de grupos visibles actualmente

  const conTutor = grupos.filter((g) => Number(g.idtutor || 0) > 0).length; // cuenta grupos que sí tienen tutor asignado

  const conPeriodo = grupos.filter(
    (g) => g.fecha_inicio_servicio && g.fecha_termino_servicio, // cuenta grupos que tienen ambas fechas definidas
  ).length;

  if (totalGrupos) totalGrupos.textContent = total; // actualiza tarjeta de total
  if (gruposConTutor) gruposConTutor.textContent = conTutor; // actualiza tarjeta con tutor
  if (gruposConPeriodo) gruposConPeriodo.textContent = conPeriodo; // actualiza tarjeta con periodo
}

// =========================================================
// FILTRO DE CUATRIMESTRE
// =========================================================
function llenarFiltroCuatrimestre() {
  if (!filtroCuatrimestre) return; // si no existe el select, sale

  const valorActual = filtroCuatrimestre.value; // guarda el valor actual para no perder selección al regenerar opciones

  const cuatrimestres = [
    ...new Set(
      gruposOriginales
        .map((g) => String(g.cuatrimestre || "").trim()) // toma los cuatrimestres como texto
        .filter(Boolean), // elimina vacíos
    ),
  ].sort((a, b) => a.localeCompare(b, "es", { numeric: true })); // ordena correctamente aunque sean números como texto

  filtroCuatrimestre.innerHTML = `<option value="">Todos</option>`; // opción base para ver todos

  cuatrimestres.forEach((cuatri) => {
    filtroCuatrimestre.innerHTML += `
      <option value="${escaparHTML(cuatri)}">${escaparHTML(cuatri)}</option>
    `; // agrega una opción por cada cuatrimestre encontrado
  });

  filtroCuatrimestre.value = valorActual; // restaura la selección previa
}

// =========================================================
// RENDER DE TUTORES EN SELECT
// =========================================================
function llenarSelectTutores(idTutorSeleccionado = "") {
  if (!selectTutorGrupo) return; // valida que exista el select

  selectTutorGrupo.innerHTML = `
    <option value="">Sin tutor asignado</option>
  `; // primera opción para dejar grupo sin tutor

  tutoresDisponibles.forEach((tutor) => {
    const seleccionado =
      String(tutor.idtutor) === String(idTutorSeleccionado) ? "selected" : ""; // marca opción seleccionada si coincide el id

    selectTutorGrupo.innerHTML += `
      <option value="${tutor.idtutor}" ${seleccionado}>
        ${escaparHTML(tutor.nombre)}
      </option>
    `; // agrega cada tutor al select
  });
}

// =========================================================
// APLICAR FILTROS
// =========================================================
function aplicarFiltrosGrupos() {
  let filtrados = [...gruposOriginales]; // crea copia para no alterar arreglo original

  const texto = buscarGrupo?.value.trim().toLowerCase() || ""; // obtiene texto de búsqueda
  const cuatri = filtroCuatrimestre?.value || ""; // obtiene cuatrimestre elegido
  const estadoTutor = filtroTutor?.value || ""; // obtiene filtro de estado de tutor

  if (texto) {
    // si hay texto para buscar
    filtrados = filtrados.filter((g) => {
      const nombreGrupo = (g.grupo || "").toLowerCase(); // nombre del grupo en minúsculas
      const turno = (g.turno || "").toLowerCase(); // turno en minúsculas
      return nombreGrupo.includes(texto) || turno.includes(texto); // busca coincidencia en grupo o turno
    });
  }

  if (cuatri) {
    // si eligieron cuatrimestre
    filtrados = filtrados.filter(
      (g) => String(g.cuatrimestre || "") === String(cuatri), // deja solo grupos del cuatrimestre seleccionado
    );
  }

  if (estadoTutor === "con_tutor") {
    // filtro para mostrar solo grupos con tutor
    filtrados = filtrados.filter((g) => Number(g.idtutor || 0) > 0);
  }

  if (estadoTutor === "sin_tutor") {
    // filtro para mostrar solo grupos sin tutor
    filtrados = filtrados.filter((g) => !Number(g.idtutor || 0));
  }

  renderizarGrupos(filtrados); // dibuja los grupos ya filtrados
  actualizarResumen(filtrados); // actualiza resumen con base en lo filtrado
}

// =========================================================
// RENDER DE GRUPOS
// =========================================================
function renderizarGrupos(grupos) {
  if (!listaGruposAdmin) return; // valida que exista el contenedor

  listaGruposAdmin.innerHTML = ""; // limpia contenido anterior

  if (!grupos || grupos.length === 0) {
    // si no hay grupos para mostrar
    listaGruposAdmin.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">
          No se encontraron grupos con ese filtro.
        </td>
      </tr>
    `; // muestra fila informativa
    return;
  }

  grupos.forEach((grupo) => {
    const inicio = grupo.fecha_inicio_servicio
      ? formatearFecha(grupo.fecha_inicio_servicio) // si hay fecha inicio, la formatea
      : `<span class="periodo-vacio">Sin definir</span>`; // si no, muestra texto

    const termino = grupo.fecha_termino_servicio
      ? formatearFecha(grupo.fecha_termino_servicio) // si hay fecha fin, la formatea
      : `<span class="periodo-vacio">Sin definir</span>`; // si no, muestra texto

    listaGruposAdmin.innerHTML += `
      <tr>
        <td>
          <div class="nombre-grupo-tabla">${escaparHTML(grupo.grupo)}</div>
          <div class="meta-grupo-tabla">ID: ${grupo.idgrupo}</div>
        </td>

        <td>${escaparHTML(grupo.turno || "N/A")}</td>

        <td>${escaparHTML(grupo.cuatrimestre || "N/A")}</td>

        <td>${obtenerBadgeTutor(grupo)}</td>

        <td>${inicio}</td>

        <td>${termino}</td>

        <td class="text-center">
          <button
            class="btn btn-outline-primary btn-sm fw-bold"
            onclick="abrirModalGrupo(${grupo.idgrupo})"
          >
            Configurar
          </button>
        </td>
      </tr>
    `; // crea una fila por grupo y agrega botón de configurar
  });
}

// =========================================================
// BUSCAR GRUPO POR ID
// =========================================================
function buscarGrupoPorId(id) {
  return gruposOriginales.find((g) => Number(g.idgrupo) === Number(id)); // busca un grupo por id dentro del arreglo original
}

// =========================================================
// ABRIR MODAL
// =========================================================
function abrirModalGrupo(id) {
  ocultarAlerta(); // oculta alerta principal
  ocultarAlertaModal(); // oculta alerta del modal

  const grupo = buscarGrupoPorId(id); // busca el grupo seleccionado
  if (!grupo) return; // si no existe, termina

  grupoId.value = grupo.idgrupo; // carga id del grupo
  grupoNombre.value = grupo.grupo || ""; // carga nombre del grupo
  grupoTurno.value = grupo.turno || "Matutino"; // carga turno o deja matutino por defecto
  grupoCuatrimestre.value = grupo.cuatrimestre || ""; // carga cuatrimestre

  llenarSelectTutores(grupo.idtutor || ""); // llena el select de tutores y marca el actual si existe
  fechaInicioServicioGrupo.value = normalizarFechaInput(
    grupo.fecha_inicio_servicio, // carga fecha inicio en formato correcto para input
  );
  fechaTerminoServicioGrupo.value = normalizarFechaInput(
    grupo.fecha_termino_servicio, // carga fecha término en formato correcto para input
  );

  modalGrupo.show(); // abre el modal
}

// =========================================================
// CARGAR TUTORES
// =========================================================
async function cargarTutores() {
  try {
    const res = await fetch(API_TUTORES, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"), // manda token para autenticar
      },
    });

    const data = await res.json(); // intenta convertir respuesta a JSON

    if (!res.ok) {
      // si backend responde error
      console.error("Error al cargar tutores:", data); // muestra detalle en consola
      tutoresDisponibles = []; // limpia arreglo
      return;
    }

    tutoresDisponibles = Array.isArray(data) ? data : []; // guarda tutores si la respuesta es arreglo
  } catch (error) {
    console.error("Error de conexión al cargar tutores:", error); // error de red
    tutoresDisponibles = []; // deja arreglo vacío para evitar fallos
  }
}

// =========================================================
// CARGAR GRUPOS
// =========================================================
async function cargarGrupos() {
  try {
    const res = await fetch(API_GRUPOS, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"), // manda token de autenticación
      },
    });

    const data = await res.json(); // lee respuesta JSON

    if (!res.ok) {
      // si hubo error del backend
      console.error("Error al cargar grupos:", data); // muestra error en consola
      if (listaGruposAdmin) {
        listaGruposAdmin.innerHTML = `
          <tr>
            <td colspan="7" class="text-center text-danger py-4">
              Error al cargar grupos.
            </td>
          </tr>
        `; // muestra mensaje de error en tabla
      }
      return;
    }

    gruposOriginales = Array.isArray(data) ? data : []; // guarda grupos si la respuesta es arreglo
    llenarFiltroCuatrimestre(); // llena el select de cuatrimestres con base en los datos
    aplicarFiltrosGrupos(); // renderiza tabla y resumen
  } catch (error) {
    console.error("Error de conexión al cargar grupos:", error); // error de red

    if (listaGruposAdmin) {
      listaGruposAdmin.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-danger py-4">
            Error de conexión con el servidor.
          </td>
        </tr>
      `; // muestra mensaje de error de conexión en la tabla
    }
  }
}

// =========================================================
// GUARDAR CAMBIOS DEL GRUPO
// =========================================================
async function guardarGrupo(e) {
  e.preventDefault(); // evita que el formulario recargue la página
  ocultarAlerta(); // limpia alerta general
  ocultarAlertaModal(); // limpia alerta del modal

  const id = grupoId.value; // obtiene id del grupo a modificar
  const turno = grupoTurno.value || ""; // obtiene turno
  const idtutor = selectTutorGrupo.value || null; // obtiene tutor o null si no hay
  const fechaInicio = fechaInicioServicioGrupo.value || null; // obtiene fecha inicio o null
  const fechaTermino = fechaTerminoServicioGrupo.value || null; // obtiene fecha término o null

  if (!turno || (turno !== "Matutino" && turno !== "Vespertino")) {
    // valida turno permitido
    mostrarAlertaModal("Debes seleccionar un turno válido.", "danger");
    return;
  }

  if (fechaInicio && fechaTermino && fechaTermino < fechaInicio) {
    // valida que fecha fin no sea menor que inicio
    mostrarAlertaModal(
      "La fecha de término no puede ser menor que la fecha de inicio.",
      "danger",
    );
    return;
  }

  try {
    const res = await fetch(`${API_GRUPOS}/${id}`, {
      method: "PUT", // actualiza configuración del grupo
      headers: getHeaders(), // manda token y JSON
      body: JSON.stringify({
        turno, // turno seleccionado
        idtutor, // tutor seleccionado o null
        fecha_inicio_servicio: fechaInicio, // fecha inicio del servicio
        fecha_termino_servicio: fechaTermino, // fecha fin del servicio
      }),
    });

    const data = await res.json(); // lee respuesta

    if (!res.ok) {
      // si hubo error del backend
      mostrarAlertaModal(
        data.msg ||
          data.error ||
          "Error al guardar la configuración del grupo.", // prioriza mensaje del backend
        "danger",
      );
      return;
    }

    modalGrupo.hide(); // cierra modal si todo salió bien
    mostrarAlerta("Grupo actualizado correctamente.", "success"); // muestra mensaje de éxito arriba
    await cargarGrupos(); // recarga grupos para refrescar tabla
  } catch (error) {
    console.error("Error al guardar grupo:", error); // error de red
    mostrarAlertaModal("Error de conexión con el servidor.", "danger"); // mensaje en modal
  }
}

// =========================================================
// LIMPIAR FILTROS
// =========================================================
function limpiarFiltrosGrupos() {
  if (buscarGrupo) buscarGrupo.value = ""; // limpia input de búsqueda
  if (filtroCuatrimestre) filtroCuatrimestre.value = ""; // limpia filtro de cuatrimestre
  if (filtroTutor) filtroTutor.value = ""; // limpia filtro de tutor

  aplicarFiltrosGrupos(); // vuelve a mostrar todo sin filtros
}

// =========================================================
// EVENTOS
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {
  modalGrupo = new bootstrap.Modal(document.getElementById("modalGrupo")); // crea instancia del modal una vez que el DOM ya existe

  document
    .getElementById("modalGrupo")
    .addEventListener("hidden.bs.modal", () => {
      ocultarAlertaModal(); // al cerrar el modal, limpia alertas internas
      formGrupo.reset(); // también limpia el formulario
    });

  await cargarTutores(); // primero carga tutores para llenar el select
  await cargarGrupos(); // luego carga grupos para renderizar tabla
});

if (buscarGrupo) {
  buscarGrupo.addEventListener("input", aplicarFiltrosGrupos); // al escribir en búsqueda, aplica filtros en tiempo real
}

if (filtroCuatrimestre) {
  filtroCuatrimestre.addEventListener("change", aplicarFiltrosGrupos); // al cambiar cuatrimestre, filtra
}

if (filtroTutor) {
  filtroTutor.addEventListener("change", aplicarFiltrosGrupos); // al cambiar filtro de tutor, filtra
}

if (btnLimpiarFiltrosGrupos) {
  btnLimpiarFiltrosGrupos.addEventListener("click", limpiarFiltrosGrupos); // limpia filtros al hacer clic
}

if (formGrupo) {
  formGrupo.addEventListener("submit", guardarGrupo); // guarda cambios del grupo al enviar el formulario
}

// =========================================================
// FUNCIONES GLOBALES
// =========================================================
window.abrirModalGrupo = abrirModalGrupo; // expone la función para que pueda llamarse desde onclick en el HTML
