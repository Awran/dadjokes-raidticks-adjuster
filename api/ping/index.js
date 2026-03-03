module.exports = async function (context, req) {
  context.log('Ping endpoint called');
  
  context.res = {
    status: 200,
    body: 'pong'
  };
};
