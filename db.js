const mysql = require("mysql2"); //Aqui dice que se requiere mysql2, que es una biblioteca para conectarse a BDs con Node.js, y se asigna a la variable mysql

//Configuiración de la conexión a la BD
const connection = mysql.createConnection({
  //Se crea una constante llamada connection, = mysql.createConnection, que es un método de mysql para crear una conexión a la base de datos, y se le pasan los siguientes parámetros:
  host: "127.0.0.1", //host es la dirección del servidor de la BD, es este caso 127.0.0.1 que es igual a localhost
  user: "root", //user es el usuario para acceder a la BD, que en este caso es root
  password: "", //Contraseña del usuario que entra a la BD, que no hay
  database: "tableroserviciosocial", //nombre de la BD
});

//Crea la conexion a la BD y maneja errores
connection.connect((err) => {
  //connection.connect es un método para establecer la conexión a la BD, y se le pasa una función de callback que recibe un parámetro err, que es el error si ocurre alguno
  if (err) {
    //si err es verdadero entonces se imprime el error en consola y se retorna para detener la ejecución del programa
    console.error("Error MySQL:", err); //se imrpime el error que ocurrio
    return;
  }
  console.log("Conectado a MySQL"); //Si err es falso, se imprime que se conecto a mysql
});

module.exports = connection;
//module.exports es una forma de exportar la conexión a la BD para que pueda ser utilizada en otros archivos del proyecto, como server.js, donde se importa esta conexión para realizar consultas a la BD.
