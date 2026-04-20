/* =========================================================
   URL DE LA API DE LOGIN
========================================================= */

// Esta constante guarda la ruta del backend que se usa para iniciar sesión
const API_URL = "http://127.0.0.1:3000/api/login";

// Se obtiene la referencia al formulario de login desde el HTML
const form = document.getElementById("loginForm");

// Se obtiene la referencia al párrafo donde se mostrará el error
const errorMsg = document.getElementById("errorMsg");

/* =========================
   LOGIN
========================= */

// Se agrega un evento submit al formulario de login
// Esto significa que esta función se ejecuta cuando el usuario da clic en "Iniciar sesión"
form.addEventListener("submit", async (e) => {
  // e.preventDefault() evita que el formulario se envíe de la forma tradicional
  // para poder controlarlo con JavaScript
  e.preventDefault();

  // Se limpia cualquier mensaje de error anterior
  if (errorMsg) errorMsg.textContent = "";

  // Se obtiene el valor del input email y se le quitan espacios al inicio o final
  const email = document.getElementById("email").value.trim();

  // Se obtiene el valor del input password y también se le quitan espacios
  const password = document.getElementById("password").value.trim();

  // Validación básica
  if (!email || !password) {
    if (errorMsg) errorMsg.textContent = "Completa todos los campos.";
    return;
  }

  try {
    // Se hace una petición POST al backend para intentar iniciar sesión
    const res = await fetch(API_URL, {
      method: "POST", // POST porque estamos enviando datos al servidor
      headers: {
        "Content-Type": "application/json", // Indicamos que el body va en formato JSON
      },
      // Se manda al backend un objeto con email y password convertido a JSON
      body: JSON.stringify({ email, password }),
    });

    // Se convierte la respuesta del backend a JSON
    const data = await res.json();

    // Si la respuesta no fue correcta, se muestra el error recibido del servidor
    if (!res.ok) {
      if (errorMsg) {
        errorMsg.textContent = data.error || "Error al iniciar sesión.";
      } else {
        alert(data.error || "Error al iniciar sesión.");
      }
      return;
    }

    // =========================
    // GUARDAR DATOS DE SESIÓN
    // =========================

    // Se guarda el nombre del usuario en localStorage
    localStorage.setItem("usuario", data.usuario);

    // Se guarda el rol del usuario en localStorage
    localStorage.setItem("rol", data.rol);

    // Se guarda el token JWT en localStorage
    // Este token servirá después para acceder a rutas protegidas
    localStorage.setItem("token", data.token);

    // Se muestra un mensaje de bienvenida
    alert("Bienvenido " + data.usuario);

    // Después de iniciar sesión, se redirige a la portada del sistema
    window.location.href = "/html/portada.html";
  } catch (err) {
    // Si falla la conexión o ocurre otro error, se imprime en consola
    console.error(err);

    // Y se muestra un mensaje general al usuario
    if (errorMsg) {
      errorMsg.textContent = "Error de conexión con el servidor.";
    } else {
      alert("Error de conexión");
    }
  }
});

/*
RESUMEN GENERAL DEL ARCHIVO login.js

Este archivo login.js se encarga únicamente de controlar
la lógica de inicio de sesión del sistema.

Sus funciones principales son:

1. Enviar email y contraseña al backend para iniciar sesión.
2. Guardar en localStorage:
   - usuario
   - rol
   - token
3. Redirigir al usuario a la portada después del login.
4. Mostrar mensajes de error si las credenciales son incorrectas
   o si hay un problema de conexión.

En pocas palabras, este archivo conecta la vista de login
con el backend y controla solamente el acceso al sistema.
*/
