# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Firebase Realtime Database (batallas online)

El matchmaking y las salas online utilizan Realtime Database. Configura
`VITE_FIREBASE_DATABASE_URL` en el entorno local y en las variables del
proveedor de despliegue con la URL de la instancia mostrada en Firebase
Console → Realtime Database. Mantén las demás variables `VITE_FIREBASE_*`
que ya utiliza la aplicación.

Las reglas están en `database.rules.json`. Para publicarlas:

```bash
firebase deploy --only database
```

Firestore sigue almacenando perfiles, colección, mazos, amigos y retos.
