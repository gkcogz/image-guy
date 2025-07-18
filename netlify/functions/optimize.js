// Bu dosyanın adı: netlify/functions/optimize.js

// Netlify Functions için standart handler (işleyici) fonksiyonu
exports.handler = async (event, context) => {
    
    // Şimdilik sadece fonksiyonun çağrıldığını loglayalım.
    // Bu logları Netlify panelindeki fonksiyon loglarında görebiliriz.
    console.log("Optimize fonksiyonu çağrıldı!");

    // Başarılı bir yanıt döndürelim.
    // body içeriği her zaman bir string olmalıdır, bu yüzden JSON nesnesini string'e çeviriyoruz.
    return {
        statusCode: 200, // 200, işlemin başarılı olduğunu belirten standart HTTP kodudur.
        body: JSON.stringify({ 
            message: "Hello from the Image Guy backend!" 
        })
    };
};