/* =========================================================
   VALIDAR SESIÓN
========================================================= */
(function validarSesionAdminGrupos() {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol")?.toLowerCase();

  if (!usuario || !rol) {
    window.location.replace("/index.html");
    return;
  }

  if (rol !== "administrador") {
    alert("No tienes permisos para entrar a Gestión de Grupos.");
    window.location.replace("/html/portada.html");
  }
})();

/* =========================================================
   ENDPOINTS
   NOTA:
   Estos endpoints deben existir en server.js
========================================================= */
const API_GRUPOS = "http://127.0.0.1:3000/api/admin/grupos";
const API_TUTORES = "http://127.0.0.1:3000/api/admin/tutores";

/* =========================================================
   VARIABLES GLOBALES
========================================================= */
let gruposOriginales = [];
let tutoresDisponibles = [];
let modalGrupo = null;

/* =========================================================
   REFERENCIAS DEL DOM
========================================================= */
const listaGruposAdmin = document.getElementById("listaGruposAdmin");
const alertaGrupos = document.getElementById("alertaGrupos");

const totalGrupos = document.getElementById("totalGrupos");
const gruposConTutor = document.getElementById("gruposConTutor");
const gruposConPeriodo = document.getElementById("gruposConPeriodo");

const buscarGrupo = document.getElementById("buscarGrupo");
const filtroCuatrimestre = document.getElementById("filtroCuatrimestre");
const filtroTutor = document.getElementById("filtroTutor");
const btnLimpiarFiltrosGrupos = document.getElementById(
  "btnLimpiarFiltrosGrupos",
);

// Modal
const formGrupo = document.getElementById("formGrupo");
const grupoId = document.getElementById("grupoId");
const grupoNombre = document.getElementById("grupoNombre");
const grupoTurno = document.getElementById("grupoTurno");
const grupoCuatrimestre = document.getElementById("grupoCuatrimestre");
const selectTutorGrupo = document.getElementById("selectTutorGrupo");
const fechaInicioServicioGrupo = document.getElementById(
  "fechaInicioServicioGrupo",
);
const fechaTerminoServicioGrupo = document.getElementById(
  "fechaTerminoServicioGrupo",
);

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

function formatearFecha(fecha) {
  if (!fecha) return "";

  const fechaLimpia = String(fecha).split("T")[0];
  const partes = fechaLimpia.split("-");

  if (partes.length !== 3) return fechaLimpia;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function normalizarFechaInput(fecha) {
  if (!fecha) return "";
  return String(fecha).split("T")[0];
}

/* =========================================================
   ALERTAS
========================================================= */
function mostrarAlerta(mensaje, tipo = "success") {
  if (!alertaGrupos) return;

  alertaGrupos.className = `alert alert-${tipo}`;
  alertaGrupos.textContent = mensaje;
  alertaGrupos.classList.remove("d-none");
}

function ocultarAlerta() {
  if (!alertaGrupos) return;

  alertaGrupos.className = "alert d-none";
  alertaGrupos.textContent = "";
}

/* =========================================================
   RESUMEN
========================================================= */
function actualizarResumen(grupos) {
  const total = grupos.length;

  const conTutor = grupos.filter((g) => Number(g.idtutor || 0) > 0).length;

  const conPeriodo = grupos.filter(
    (g) => g.fecha_inicio_servicio && g.fecha_termino_servicio,
  ).length;

  if (totalGrupos) totalGrupos.textContent = total;
  if (gruposConTutor) gruposConTutor.textContent = conTutor;
  if (gruposConPeriodo) gruposConPeriodo.textContent = conPeriodo;
}

/* =========================================================
   FILTRO DE CUATRIMESTRE
========================================================= */
function llenarFiltroCuatrimestre() {
  if (!filtroCuatrimestre) return;

  const valorActual = filtroCuatrimestre.value;

  const cuatrimestres = [
    ...new Set(
      gruposOriginales
        .map((g) => String(g.cuatrimestre || "").trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

  filtroCuatrimestre.innerHTML = `<option value="">Todos</option>`;

  cuatrimestres.forEach((cuatri) => {
    filtroCuatrimestre.innerHTML += `
      <option value="${escaparHTML(cuatri)}">${escaparHTML(cuatri)}</option>
    `;
  });

  filtroCuatrimestre.value = valorActual;
}

/* =========================================================
   RENDER DE TUTORES EN SELECT
========================================================= */
function llenarSelectTutores(idTutorSeleccionado = "") {
  if (!selectTutorGrupo) return;

  selectTutorGrupo.innerHTML = `
    <option value="">Sin tutor asignado</option>
  `;

  tutoresDisponibles.forEach((tutor) => {
    const seleccionado =
      String(tutor.idtutor) === String(idTutorSeleccionado) ? "selected" : "";

    selectTutorGrupo.innerHTML += `
      <option value="${tutor.idtutor}" ${seleccionado}>
        ${escaparHTML(tutor.nombre)}
      </option>
    `;
  });
}

/* =========================================================
   APLICAR FILTROS
========================================================= */
function aplicarFiltrosGrupos() {
  let filtrados = [...gruposOriginales];

  const texto = buscarGrupo?.value.trim().toLowerCase() || "";
  const cuatri = filtroCuatrimestre?.value || "";
  const estadoTutor = filtroTutor?.value || "";

  if (texto) {
    filtrados = filtrados.filter((g) => {
      const nombreGrupo = (g.grupo || "").toLowerCase();
      const turno = (g.turno || "").toLowerCase();
      return nombreGrupo.includes(texto) || turno.includes(texto);
    });
  }

  if (cuatri) {
    filtrados = filtrados.filter(
      (g) => String(g.cuatrimestre || "") === String(cuatri),
    );
  }

  if (estadoTutor === "con_tutor") {
    filtrados = filtrados.filter((g) => Number(g.idtutor || 0) > 0);
  }

  if (estadoTutor === "sin_tutor") {
    filtrados = filtrados.filter((g) => !Number(g.idtutor || 0));
  }

  renderizarGrupos(filtrados);
  actualizarResumen(filtrados);
}

/* =========================================================
   RENDER DE GRUPOS
========================================================= */
function renderizarGrupos(grupos) {
  if (!listaGruposAdmin) return;

  listaGruposAdmin.innerHTML = "";

  if (!grupos || grupos.length === 0) {
    listaGruposAdmin.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">
          No se encontraron grupos con ese filtro.
        </td>
      </tr>
    `;
    return;
  }

  grupos.forEach((grupo) => {
    const tutorAsignado = grupo.nombre_tutor
      ? escaparHTML(grupo.nombre_tutor)
      : "Sin tutor";

    const claseTutor = grupo.nombre_tutor
      ? "badge-tutor badge-tutor-asignado"
      : "badge-tutor badge-tutor-sin";

    const inicio = grupo.fecha_inicio_servicio
      ? formatearFecha(grupo.fecha_inicio_servicio)
      : `<span class="periodo-vacio">Sin definir</span>`;

    const termino = grupo.fecha_termino_servicio
      ? formatearFecha(grupo.fecha_termino_servicio)
      : `<span class="periodo-vacio">Sin definir</span>`;

    listaGruposAdmin.innerHTML += `
      <tr>
        <td>
          <div class="nombre-grupo-tabla">${escaparHTML(grupo.grupo)}</div>
          <div class="meta-grupo-tabla">ID: ${grupo.idgrupo}</div>
        </td>

        <td>${escaparHTML(grupo.turno || "N/A")}</td>

        <td>${escaparHTML(grupo.cuatrimestre || "N/A")}</td>

        <td>
          <span class="${claseTutor}">
            ${tutorAsignado}
          </span>
        </td>

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
    `;
  });
}

/* =========================================================
   BUSCAR GRUPO POR ID
========================================================= */
function buscarGrupoPorId(id) {
  return gruposOriginales.find((g) => Number(g.idgrupo) === Number(id));
}

/* =========================================================
   ABRIR MODAL
========================================================= */
function abrirModalGrupo(id) {
  ocultarAlerta();

  const grupo = buscarGrupoPorId(id);
  if (!grupo) return;

  grupoId.value = grupo.idgrupo;
  grupoNombre.value = grupo.grupo || "";
  grupoTurno.value = grupo.turno || "";
  grupoCuatrimestre.value = grupo.cuatrimestre || "";

  llenarSelectTutores(grupo.idtutor || "");
  fechaInicioServicioGrupo.value = normalizarFechaInput(
    grupo.fecha_inicio_servicio,
  );
  fechaTerminoServicioGrupo.value = normalizarFechaInput(
    grupo.fecha_termino_servicio,
  );

  modalGrupo.show();
}

/* =========================================================
   CARGAR TUTORES
========================================================= */
async function cargarTutores() {
  try {
    const res = await fetch(API_TUTORES, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Error al cargar tutores:", data);
      tutoresDisponibles = [];
      return;
    }

    tutoresDisponibles = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error de conexión al cargar tutores:", error);
    tutoresDisponibles = [];
  }
}

/* =========================================================
   CARGAR GRUPOS
========================================================= */
async function cargarGrupos() {
  try {
    const res = await fetch(API_GRUPOS, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Error al cargar grupos:", data);
      if (listaGruposAdmin) {
        listaGruposAdmin.innerHTML = `
          <tr>
            <td colspan="7" class="text-center text-danger py-4">
              Error al cargar grupos.
            </td>
          </tr>
        `;
      }
      return;
    }

    gruposOriginales = Array.isArray(data) ? data : [];
    llenarFiltroCuatrimestre();
    aplicarFiltrosGrupos();
  } catch (error) {
    console.error("Error de conexión al cargar grupos:", error);

    if (listaGruposAdmin) {
      listaGruposAdmin.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-danger py-4">
            Error de conexión con el servidor.
          </td>
        </tr>
      `;
    }
  }
}

/* =========================================================
   GUARDAR CAMBIOS DEL GRUPO
========================================================= */
async function guardarGrupo(e) {
  e.preventDefault();
  ocultarAlerta();

  const id = grupoId.value;
  const idtutor = selectTutorGrupo.value || null;
  const fechaInicio = fechaInicioServicioGrupo.value || null;
  const fechaTermino = fechaTerminoServicioGrupo.value || null;

  if (fechaInicio && fechaTermino && fechaTermino < fechaInicio) {
    mostrarAlerta(
      "La fecha de término no puede ser menor que la fecha de inicio.",
      "danger",
    );
    return;
  }

  try {
    const res = await fetch(`${API_GRUPOS}/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({
        idtutor,
        fecha_inicio_servicio: fechaInicio,
        fecha_termino_servicio: fechaTermino,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      mostrarAlerta(
        data.msg ||
          data.error ||
          "Error al guardar la configuración del grupo.",
        "danger",
      );
      return;
    }

    modalGrupo.hide();
    mostrarAlerta("Grupo actualizado correctamente.", "success");
    await cargarGrupos();
  } catch (error) {
    console.error("Error al guardar grupo:", error);
    mostrarAlerta("Error de conexión con el servidor.", "danger");
  }
}

/* =========================================================
   LIMPIAR FILTROS
========================================================= */
function limpiarFiltrosGrupos() {
  if (buscarGrupo) buscarGrupo.value = "";
  if (filtroCuatrimestre) filtroCuatrimestre.value = "";
  if (filtroTutor) filtroTutor.value = "";

  aplicarFiltrosGrupos();
}

/* =========================================================
   EVENTOS
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  modalGrupo = new bootstrap.Modal(document.getElementById("modalGrupo"));

  await cargarTutores();
  await cargarGrupos();
});

if (buscarGrupo) {
  buscarGrupo.addEventListener("input", aplicarFiltrosGrupos);
}

if (filtroCuatrimestre) {
  filtroCuatrimestre.addEventListener("change", aplicarFiltrosGrupos);
}

if (filtroTutor) {
  filtroTutor.addEventListener("change", aplicarFiltrosGrupos);
}

if (btnLimpiarFiltrosGrupos) {
  btnLimpiarFiltrosGrupos.addEventListener("click", limpiarFiltrosGrupos);
}

if (formGrupo) {
  formGrupo.addEventListener("submit", guardarGrupo);
}

/* =========================================================
   FUNCIONES GLOBALES
========================================================= */
window.abrirModalGrupo = abrirModalGrupo;

/*
RESUMEN GENERAL DEL ARCHIVO admin-grupos.js

Este archivo se encarga de controlar la vista de gestión de grupos.

Sus funciones principales son:

1. Validar que solo el administrador pueda entrar.
2. Cargar los grupos desde el backend.
3. Cargar los tutores disponibles.
4. Mostrar resumen de grupos:
   - total
   - con tutor
   - con periodo
5. Filtrar por:
   - nombre de grupo
   - cuatrimestre
   - estado de tutor
6. Abrir un modal para configurar cada grupo.
7. Permitir asignar tutor.
8. Permitir guardar fecha de inicio y término del servicio.
9. Actualizar la tabla después de guardar.

En pocas palabras, este archivo conecta la vista admin-grupos
con el backend y permite administrar la configuración académica
de cada grupo.
*/
