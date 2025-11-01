// Discord User ID - Bu kısmı kendi Discord ID'nizle değiştirin
const USER_ID = '1413826380029755504';

let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000; // 3 saniye

// Discord status güncelleme fonksiyonu
function updateDiscordStatus(data) {
    // Avatar güncelle
    const avatarImg = document.querySelector('.avatarImage');
    if (avatarImg && data.discord_user) {
        const avatarUrl = data.discord_user.avatar 
            ? `https://cdn.discordapp.com/avatars/${data.discord_user.id}/${data.discord_user.avatar}.${data.discord_user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${data.discord_user.discriminator % 5}.png`;
        
        avatarImg.src = avatarUrl;
        console.log('Avatar güncellendi:', avatarUrl);
        
        // Ana profil avatar'ını da güncelle
        const mainAvatar = document.querySelector('.avatar');
        if (mainAvatar) {
            const mainAvatarUrl = data.discord_user.avatar 
                ? `https://cdn.discordapp.com/avatars/${data.discord_user.id}/${data.discord_user.avatar}.${data.discord_user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
                : `https://cdn.discordapp.com/embed/avatars/${data.discord_user.discriminator % 5}.png`;
            mainAvatar.src = mainAvatarUrl;
        }
    }
    
    // Kullanıcı adlarını güncelle
    if (data.discord_user) {
        // Ana profil kullanıcı adını güncelle (global_name varsa onu, yoksa username'i kullan)
        const profileUsername = document.querySelector('.profileUsername span');
        if (profileUsername) {
            const displayName = data.discord_user.global_name || data.discord_user.display_name || data.discord_user.username;
            profileUsername.textContent = displayName;
            console.log('Profil kullanıcı adı güncellendi:', displayName);
        }
        
        // Discord activity kısmındaki kullanıcı adını güncelle (username)
        const discordUsernameSpan = document.querySelector('.discordUserDiv span');
        if (discordUsernameSpan) {
            discordUsernameSpan.textContent = data.discord_user.username;
            console.log('Discord username güncellendi:', data.discord_user.username);
        }
        
        // Discord activity kısmındaki display name'i güncelle
        const discordDisplayName = document.querySelector('.discordUser h3');
        if (discordDisplayName) {
            const displayName = data.discord_user.global_name || data.discord_user.display_name || data.discord_user.username;
            discordDisplayName.textContent = displayName;
            console.log('Discord display name güncellendi:', displayName);
        }
    }
    
    // Status güncelle
    const statusImg = document.querySelector('.discordStatus');
    if (statusImg) {
        const status = data.discord_status || 'offline';
        switch(status) {
            case 'online':
                statusImg.src = '/img/online.png';
                break;
            case 'idle':
                statusImg.src = '/img/idle.png';
                break;
            case 'dnd':
                statusImg.src = '/img/dnd.png';
                break;
            default:
                statusImg.src = '/img/offline.png';
        }
        console.log('Discord status güncellendi:', status);
    }
    
    // Aktivite bilgisini de göstermek isterseniz
    if (data.activities && data.activities.length > 0) {
        const activity = data.activities[0];
        console.log('Şu anki aktivite:', activity.name);
    }
}

// WebSocket bağlantısını kur
function connectToLanyard() {
    if (USER_ID === 'BURAYA_DISCORD_USER_ID_GIRIN') {
        console.error('Lütfen USER_ID değişkenini kendi Discord ID\'nizle değiştirin!');
        return;
    }

    console.log('Lanyard API\'ye bağlanıyor...');
    ws = new WebSocket('wss://api.lanyard.rest/socket');
    
    ws.onopen = function() {
        console.log('Lanyard WebSocket bağlantısı kuruldu');
        reconnectAttempts = 0;
        
        // Kullanıcıya subscribe ol
        ws.send(JSON.stringify({
            op: 2,
            d: {
                subscribe_to_id: USER_ID
            }
        }));
    };
    
    ws.onmessage = function(event) {
        const message = JSON.parse(event.data);
        
        switch(message.op) {
            case 1: // Hello
                // Heartbeat başlat
                setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ op: 3 }));
                    }
                }, message.d.heartbeat_interval);
                break;
                
            case 0: // Event
                if (message.t === 'INIT_STATE' || message.t === 'PRESENCE_UPDATE') {
                    updateDiscordStatus(message.d);
                }
                break;
        }
    };
    
    ws.onclose = function(event) {
        console.log('Lanyard WebSocket bağlantısı kapandı:', event.reason);
        
        // Otomatik yeniden bağlanma
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Yeniden bağlanma denemesi ${reconnectAttempts}/${maxReconnectAttempts}`);
            setTimeout(connectToLanyard, reconnectDelay);
        } else {
            console.error('Maksimum yeniden bağlanma denemesi aşıldı');
            // Fallback olarak HTTP API kullan
            fallbackToHttpApi();
        }
    };
    
    ws.onerror = function(error) {
        console.error('Lanyard WebSocket hatası:', error);
    };
}

// Fallback HTTP API fonksiyonu
function fallbackToHttpApi() {
    console.log('HTTP API fallback\'ına geçiliyor...');
    
    function fetchDiscordStatus() {
        fetch(`https://api.lanyard.rest/v1/users/${USER_ID}`)
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    updateDiscordStatus(result.data);
                } else {
                    console.error('Lanyard API hatası:', result.error);
                }
            })
            .catch(error => {
                console.error('HTTP API fetch hatası:', error);
                
                // Hata durumunda offline status göster
                const statusImg = document.querySelector('.discordStatus');
                if (statusImg) {
                    statusImg.src = '/img/offline.png';
                }
            });
    }
    
    // İlk çağrı
    fetchDiscordStatus();
    
    // Her 30 saniyede bir güncelle (WebSocket kadar hızlı olmasa da)
    setInterval(fetchDiscordStatus, 30000);
}

// Sayfa yüklendiğinde bağlantıyı kur
document.addEventListener('DOMContentLoaded', function() {
    connectToLanyard();
});

// Sayfa kapanmadan önce WebSocket'i temizle
window.addEventListener('beforeunload', function() {
    if (ws) {
        ws.close();
    }
});
