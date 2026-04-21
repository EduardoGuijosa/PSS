/* =========================
   VALIDAR SESIÓN
========================= */

// Esta función revisa si existe un token guardado en localStorage
// El token se guarda cuando el usuario inicia sesión correctamente
function validarSesion() {
  // Se obtiene el token desde localStorage
  const token = localStorage.getItem("token");

  // Si no hay token, significa que el usuario no ha iniciado sesión
  // o su sesión ya no es válida, por eso se manda al login
  if (!token) {
    window.location.href = "/index.html";
  }
}

/* =========================
   CARGAR MENÚ Y TOPBAR
========================= */

// Esta función se encarga de cargar dinámicamente el menú lateral y la barra superior
// También valida la sesión antes de hacer cualquier otra cosa
function cargarLayout() {
  // Primero se valida que exista sesión
  validarSesion();

  /* =========================
     CARGAR MENÚ LATERAL
  ========================= */
  fetch("/html/menu.html")
    .then((res) => res.text())
    .then((data) => {
      const menuContainer = document.getElementById("menu-container");

      if (menuContainer) {
        menuContainer.innerHTML = data;

        // Después de insertar el menú, se configura según el rol
        configurarMenu();
      }
    })
    .catch((err) => console.error("Error cargando el menú:", err));

  /* =========================
     CARGAR BARRA SUPERIOR
  ========================= */
  fetch("/html/topbar.html")
    .then((res) => res.text())
    .then((data) => {
      const topbarContainer = document.getElementById("topbar-container");

      if (topbarContainer) {
        topbarContainer.innerHTML = data;

        // Después de insertar la topbar, carga el nombre del usuario y el rol
        cargarUsuario();
      }
    })
    .catch((err) => console.error("Error cargando la topbar:", err));
}

/* =========================
   CONFIGURAR VISIBILIDAD Y EVENTOS
========================= */

// Esta función controla:
// 1. Qué botones del menú se muestran según el rol
// 2. Qué hace cada botón cuando se le da clic
function configurarMenu() {
  // Se obtiene el rol del usuario guardado en localStorage
  // Se convierte a minúsculas para evitar problemas al comparar
  const rol = localStorage.getItem("rol")?.toLowerCase();

  // Se guardan referencias a todos los botones del menú
  const elementos = {
    // Botones normales
    btnPerfil: document.getElementById("btnPerfil"),
    btnProgreso: document.getElementById("btnProgreso"),
    btnSeguimiento: document.getElementById("btnSeguimiento"),
    btnGrupos: document.getElementById("btnGrupos"),
    btnPortada: document.getElementById("btnPortada"),
    btnProyectos: document.getElementById("btnProyectos"),
    btnSalir: document.getElementById("btnSalir"),

    // Botones exclusivos del administrador
    btnAdminUsuarios: document.getElementById("btnAdminUsuarios"),
    btnAdminGrupos: document.getElementById("btnAdminGrupos"),
  };

  /* =========================
     OCULTAR TODO PRIMERO
     - Esto ayuda a tener más control y menos errores
  ========================= */
  Object.values(elementos).forEach((el) => {
    if (el) el.style.display = "none";
  });

  /* =========================
     MOSTRAR OPCIONES SEGÚN EL ROL
  ========================= */

  // ADMINISTRADOR
  if (rol === "administrador") {
    if (elementos.btnPortada) elementos.btnPortada.style.display = "block";
    if (elementos.btnAdminUsuarios) {
      elementos.btnAdminUsuarios.style.display = "block";
    }

    if (elementos.btnAdminGrupos) {
      elementos.btnAdminGrupos.style.display = "block";
    }
  }

  // RESPONSABLE
  else if (rol === "responsable") {
    if (elementos.btnPortada) elementos.btnPortada.style.display = "block";
    if (elementos.btnProyectos) elementos.btnProyectos.style.display = "block";
    if (elementos.btnSeguimiento) {
      elementos.btnSeguimiento.style.display = "block";
    }
    if (elementos.btnPerfil) elementos.btnPerfil.style.display = "block";
  }

  // ALUMNO
  else if (rol === "alumno") {
    if (elementos.btnPortada) elementos.btnPortada.style.display = "block";
    if (elementos.btnProyectos) elementos.btnProyectos.style.display = "block";
    if (elementos.btnProgreso) elementos.btnProgreso.style.display = "block";
    if (elementos.btnPerfil) elementos.btnPerfil.style.display = "block";
  }

  // TUTOR
  else if (rol === "tutor") {
    if (elementos.btnPortada) elementos.btnPortada.style.display = "block";
    if (elementos.btnProyectos) elementos.btnProyectos.style.display = "block";
    if (elementos.btnGrupos) elementos.btnGrupos.style.display = "block";
  }

  // DIRECTOR
  else if (rol === "director") {
    if (elementos.btnPortada) elementos.btnPortada.style.display = "block";
    if (elementos.btnProyectos) elementos.btnProyectos.style.display = "block";
    if (elementos.btnGrupos) elementos.btnGrupos.style.display = "block";
  }

  // El botón salir siempre se muestra si existe
  if (elementos.btnSalir) {
    elementos.btnSalir.style.display = "block";
  }

  /* =========================
     EVENTOS DE NAVEGACIÓN
  ========================= */

  // Ir a portada
  if (elementos.btnPortada) {
    elementos.btnPortada.addEventListener("click", () => {
      window.location.href = "/html/portada.html";
    });
  }

  // Ir a progreso
  if (elementos.btnProgreso) {
    elementos.btnProgreso.addEventListener("click", () => {
      window.location.href = "/html/progreso.html";
    });
  }

  // Ir a proyectos/actividades
  if (elementos.btnProyectos) {
    elementos.btnProyectos.addEventListener("click", () => {
      window.location.href = "/html/actividad.html";
    });
  }

  // Ir a perfil
  if (elementos.btnPerfil) {
    elementos.btnPerfil.addEventListener("click", () => {
      window.location.href = "/html/perfil.html";
    });
  }

  // Ir a seguimiento
  if (elementos.btnSeguimiento) {
    elementos.btnSeguimiento.addEventListener("click", () => {
      window.location.href = "/html/seguimiento.html";
    });
  }

  // Ir a grupos
  if (elementos.btnGrupos) {
    elementos.btnGrupos.addEventListener("click", () => {
      window.location.href = "/html/grupos.html";
    });
  }

  // Gestión de usuarios del administrador
  if (elementos.btnAdminUsuarios) {
    elementos.btnAdminUsuarios.addEventListener("click", () => {
      window.location.href = "/html/admin-usuarios.html";
    });
  }

  // Gestión de grupos del administrador
  if (elementos.btnAdminGrupos) {
    elementos.btnAdminGrupos.addEventListener("click", () => {
      window.location.href = "/html/admin-grupos.html";
    });
  }

  // Cerrar sesión
  if (elementos.btnSalir) {
    elementos.btnSalir.addEventListener("click", cerrarSesion);
  }
}

/* =========================
   CARGAR USUARIO EN TOPBAR
========================= */

// Esta función pone en la barra superior el nombre del usuario y su rol
function cargarUsuario() {
  // Se obtienen usuario y rol desde localStorage
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol");

  // Si falta alguno, se limpia localStorage y se manda al login
  if (!usuario || !rol) {
    localStorage.clear();
    window.location.replace("/index.html");
    return;
  }

  // Se obtienen los elementos del HTML donde se escribirá la información
  const bienvEl = document.getElementById("bienvenida");
  const rolEl = document.getElementById("rol");

  // Si existe el elemento de bienvenida, se escribe el nombre del usuario
  if (bienvEl) bienvEl.innerText = "Bienvenido " + usuario;

  // Si existe el elemento del rol, se escribe el rol en mayúsculas
  if (rolEl) rolEl.innerText = rol.toUpperCase();
}

/* =========================
   CERRAR SESIÓN
========================= */

// Esta función elimina todos los datos del localStorage
// y manda al usuario a la pantalla de inicio de sesión
function cerrarSesion() {
  // Borra token, usuario, rol y cualquier otro dato guardado
  localStorage.clear();

  // Redirige al login
  window.location.href = "/index.html";
}

/* =========================
   INICIAR TODO
========================= */

// DOMContentLoaded se dispara cuando el HTML de la página ya fue cargado
// Aquí se manda a llamar cargarLayout() para:
// 1. Validar sesión
// 2. Cargar menú
// 3. Cargar topbar
// 4. Configurar botones y usuario
window.addEventListener("DOMContentLoaded", cargarLayout);

/*
RESUMEN GENERAL DEL ARCHIVO layout.js

Este archivo layout.js se encarga de manejar la estructura general del sistema,
es decir, el menú lateral y la barra superior que aparecen en varias vistas.

Sus funciones principales son:

1. Validar si el usuario tiene una sesión activa mediante el token.
2. Cargar dinámicamente el menú lateral desde menu.html.
3. Cargar dinámicamente la barra superior desde topbar.html.
4. Mostrar u ocultar botones del menú según el rol del usuario.
5. Asignar eventos de navegación a cada botón del menú.
6. Mostrar en la topbar el nombre del usuario y su rol.
7. Cerrar sesión limpiando localStorage y regresando al login.

Además, ahora también:
8. Soporta el rol administrador.
9. Muestra solo:
   - Gestión de Usuarios
   - Gestión de Grupos
10. Redirige a:
   - admin.html
   - admin-grupos.html

En pocas palabras, este archivo controla la parte compartida del diseño del sistema
y adapta la navegación según el tipo de usuario que haya iniciado sesión.
*/
