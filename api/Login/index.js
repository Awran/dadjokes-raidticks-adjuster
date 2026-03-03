module.exports = async function (context, req) {
  context.res = {
    status: 410,
    body: {
      error: 'Legacy password login is disabled. Use Azure Static Web Apps sign-in at /.auth/login/aad.'
    }
  }
}
