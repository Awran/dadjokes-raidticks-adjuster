module.exports = async function (context, req) {
  context.log('Health endpoint called');
  
  context.res = {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'DKP Management API'
    })
  };
}
