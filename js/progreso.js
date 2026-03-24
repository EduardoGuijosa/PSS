function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

async function cargarProgreso() {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/progreso", {
      headers: getHeaders(),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.msg || data.error || "Error al cargar progreso");
      return;
    }

    const horasEl = document.getElementById("horasLiberadas");
    const faltantesEl = document.getElementById("horasFaltantes");
    const contenedor = document.getElementById("listaProgreso");

    // SI NO EXISTEN, NO INTENTA NADA
    if (!horasEl || !faltantesEl || !contenedor) {
      console.log("Aún no carga el DOM...");
      return;
    }

    // HORAS
    horasEl.innerText = "Horas liberadas: " + data.horasLiberadas;
    faltantesEl.innerText = "Horas faltantes: " + data.horasFaltantes;

    contenedor.innerHTML = "";

    if (!data.actividades || data.actividades.length === 0) {
      contenedor.innerHTML = "<p>No tienes actividades inscritas</p>";
      return;
    }

    // ACTIVIDADES
    data.actividades.forEach((act) => {
      contenedor.innerHTML += `
        <div class="card mb-3 shadow">
          <div class="card-body text-center">
            <h5>${act.nombreActividad}</h5>
            <p>${act.descripcion || "Sin descripción"}</p>
            <p><strong>Horas:</strong> ${act.horas_actividad}</p>
          </div>
        </div>
      `;
    });

    // MENSAJE SI COMPLETÓ
    if (data.horasFaltantes === 0) {
      alert("Felicidades! Ya completaste tus 480 horas");
    }
  } catch (error) {
    console.error(error);
    alert("Error de conexión");
  }
}
