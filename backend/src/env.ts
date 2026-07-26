// Carga backend/.env en desarrollo.
//
// Vive en su propio módulo y se importa el PRIMERO en index.ts a propósito: los
// imports de ES se evalúan en orden, y hay módulos que leen process.env al
// cargarse (middleware/auth.ts fija JWT_SECRET en una constante de nivel
// superior). Si esto se hiciera dentro de index.ts después de los imports, ya
// sería tarde.
//
// En Docker y en Azure no existe el archivo: las variables llegan del entorno
// del contenedor y `loadEnvFile` lanza ENOENT, que se ignora. Nunca pisa una
// variable ya definida en el entorno real.
try {
  process.loadEnvFile();
} catch {
  // Sin archivo .env: se usan las variables del entorno tal cual.
}
