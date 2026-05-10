/* =========================
   SUPABASE BAĞLANTI
========================= */

const SUPABASE_URL = "https://nfzibcovwmobpryczsyx.supabase.co";
const SUPABASE_KEY = "sb_publishable_hnWigsReyX6OxvJFVu7EtA_8Zow5f82";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); // Supabase istemcisini oluştur

let isAuthorized = false; // Oturum yetkisi
let targetSayfa = null;   // Giriş yapıldıktan sonra gidilecek sayfa
let currentAuthorizer = null; // Giriş yapan yetkilinin bilgilerini tutar
let sessionTimer = null; // Oturum zamanlayıcısı
const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 Dakika

/* =========================
   SAYFA AÇILINCA
========================= */

window.onload = async function () {
    await kaliplariBellegeAl();
    await operatorleriBellegeAl();

    document.getElementById("mainSystem").style.display = "block";

    const sonSayfa = localStorage.getItem("aktifSayfa") || "anaEkran"; // Varsayılan olarak anaEkran'ı aç
    sayfaAc(sonSayfa);
    oturumBilgisiGuncelle();
    menuYetkileriniUygula();
    tarihVardiyaGuncelle();

    // Aktivite takibi için dinleyiciler
    setupActivityListeners();
};

/* =========================
   SEKME AÇ
========================= */

// Bu fonksiyon artık kullanılmıyor, sayfaAc fonksiyonu tüm sayfa geçişlerini yönetiyor.
// function tabAc(tabId) {
//     let pages = document.getElementsByClassName("page");

//     for (let i = 0; i < pages.length; i++) {
//         pages[i].classList.remove("active");
//     }

//     document.getElementById(tabId).classList.add("active");
//     ekraniYenile();
// }

/* =========================
   GENEL YENİLEME
========================= */

function ekraniYenile() {
    operatorleriGoster();
    kaliplariGoster();
    yetkilileriGoster();
    secimleriDoldur(); // Yetkinlik tanımlama sayfasındaki select'leri doldurur
    yetkinlikleriGoster();
}

/* =========================
   OPERATÖR EKLE
========================= */

async function operatorEkle() {

    let sicil = document.getElementById("operatorSicil").value.trim();
    let adSoyad = document.getElementById("operatorAdSoyad").value.trim();
    let unvan = document.getElementById("operatorUnvan").value.trim();

    let resimInput = document.getElementById("operatorResim");

    if (sicil === "" || adSoyad === "") {
        alert("Sicil no ve ad soyad zorunlu.");
        return;
    }

    let resimUrl = "";

    /* =========================
       FOTOĞRAF YÜKLE
    ========================= */

    if (resimInput.files.length > 0) {

        let dosya = resimInput.files[0];

        let dosyaAdi =
            Date.now() + "_" + dosya.name.replace(/\s/g, "_");

        const { error: uploadError } = await supabaseClient
            .storage
            .from("Operator-photos")
            .upload(dosyaAdi, dosya);

        if (uploadError) {
            console.log(uploadError);
            alert("Fotoğraf yüklenemedi.");
            return;
        }

        const { data } = supabaseClient
            .storage
            .from("Operator-photos")
            .getPublicUrl(dosyaAdi);

        resimUrl = data.publicUrl;
    }

    /* =========================
       OPERATÖR EKLE
    ========================= */

    const { data, error } = await supabaseClient
    .from("operators")
    .insert([
        {
            sicil_no: sicil,
            ad_soyad: adSoyad,
            unvan: unvan,
            resim: resimUrl
        }
    ])
        .select();

    console.log("OPERATÖR INSERT DATA:", data);
    console.log("OPERATÖR INSERT ERROR:", error);

    if (error) {
    console.log(error);
    await operatorleriBellegeAl();
    alert("Operatör eklenemedi: " + error.message);
    return;
}

    document.getElementById("operatorSicil").value = "";
    document.getElementById("operatorAdSoyad").value = "";
    document.getElementById("operatorUnvan").value = "";
    document.getElementById("operatorResim").value = "";

    alert("Operatör eklendi.");
operatorEkleModalKapat();
    ekraniYenile();
}

/* =========================
   TOPLU OPERATÖR EKLE
   Format: Sicil;Ad Soyad;Ünvan
========================= */

async function topluOperatorEkle() {
    let veri = document.getElementById("topluOperator").value;

    if (veri.trim() === "") {
        alert("Veri yok.");
        return;
    }

    let satirlar = veri.split("\n");
    let kayitlar = [];

    satirlar.forEach(function (satir) {
        let parca = satir.split(";");

        if (parca.length >= 2) {
            let sicil = parca[0].trim();
            let adSoyad = parca[1].trim();
            let unvan = parca.length >= 3 ? parca[2].trim() : "";

            if (sicil !== "" && adSoyad !== "") {
                kayitlar.push({
                    sicil_no: sicil,
                    ad_soyad: adSoyad,
                    unvan: unvan,
                    resim: ""
                });
            }
        }
    });

    if (kayitlar.length === 0) {
        alert("Geçerli veri bulunamadı.");
        return;
    }

    const { error } = await supabaseClient
        .from("operators")
        .insert(kayitlar);

    if (error) {
        console.log(error);
        alert("Toplu operatör ekleme hatası: " + error.message);
        return;
    }

    document.getElementById("topluOperator").value = "";

    alert(kayitlar.length + " operatör eklendi.");

    ekraniYenile();
}

/* =========================
   OPERATÖRLERİ GÖSTER
========================= */

async function operatorleriGoster() {
    let div = document.getElementById("operatorListesi");

    if (!div) return;

    div.innerHTML = "Yükleniyor...";

    const { data, error } = await supabaseClient
        .from("operators")
        .select("*")
        .order("ad_soyad", { ascending: true });

    if (error) {
        console.log(error);
        div.innerHTML = "Operatörler yüklenemedi.";
        return;
    }

    div.innerHTML = "";

    if (!data || data.length === 0) {
        div.innerHTML = "Kayıtlı operatör yok.";
        return;
    }
    let arama = document.getElementById("operatorArama")?.value
    ?.toLowerCase()
    .trim() || "";

let filtreliData = data;

if (arama !== "") {

    filtreliData = data.filter(op => {

        let ad = op.ad_soyad?.toLowerCase() || "";
        let sicil = op.sicil_no?.toLowerCase() || "";

        return ad.includes(arama) || sicil.includes(arama);
    });
}
filtreliData.forEach(function (op) {
        let foto = op.resim ? op.resim : "default-user.png";

        div.innerHTML += `
            <div class="operator-card" onclick="operatorDetayAc(${op.id})">

                <img src="${foto}" class="operator-photo">

                <div>
                    <strong>${op.ad_soyad}</strong><br>
                    Sicil: ${op.sicil_no}<br>
                    Ünvan: ${op.unvan || "-"}<br><br>

                    <input 
                        type="file"
                        id="foto_${op.id}"
                        accept="image/*">

                    <button onclick="event.stopPropagation(); operatorFotoGuncelle(${op.id}, '${op.sicil_no}')">
                        Fotoğraf Güncelle
                    </button>

                    <br><br>

                    <button class="delete-btn" onclick="event.stopPropagation(); operatorSil('${op.sicil_no}')">
                        Sil
                    </button>
                </div>
            </div>
        `;
    });
}
/* =========================
   OPERATÖR FOTOĞRAF GÜNCELLE
========================= */

async function operatorFotoGuncelle(operatorId, sicilNo) {
    let input = document.getElementById("foto_" + operatorId);

    if (!input || input.files.length === 0) {
        alert("Fotoğraf seç.");
        return;
    }

    let dosya = input.files[0];

    let uzanti = dosya.name.split(".").pop();
    let dosyaAdi = sicilNo + "_" + Date.now() + "." + uzanti;

    const { error: uploadError } = await supabaseClient
        .storage
        .from("Operator-photos")
        .upload(dosyaAdi, dosya);

    if (uploadError) {
        console.log(uploadError);
        alert("Fotoğraf yüklenemedi: " + uploadError.message);
        return;
    }

    const { data } = supabaseClient
        .storage
        .from("Operator-photos")
        .getPublicUrl(dosyaAdi);

    const resimUrl = data.publicUrl;

    const { error } = await supabaseClient
        .from("operators")
        .update({ resim: resimUrl })
        .eq("id", operatorId);

    if (error) {
        console.log(error);
        alert("Operatör fotoğrafı güncellenemedi: " + error.message);
        return;
    }

    await operatorleriBellegeAl();

    alert("Fotoğraf güncellendi.");

    ekraniYenile();
}

/* =========================
   OPERATÖR SİL
========================= */

async function operatorSil(sicilNo) {
    if (!confirm("Bu operatörü silmek istiyor musun?")) return;

    const { error } = await supabaseClient
        .from("operators")
        .delete()
        .eq("sicil_no", sicilNo);

    if (error) {
        console.log(error);
        alert("Operatör silinemedi: " + error.message);
        return;
    }

    ekraniYenile();
}

/* =========================
   KALIP EKLE
========================= */

async function kalipEkle() {

    let kod = document.getElementById("kalipKodu").value.trim();
    let ad = document.getElementById("kalipAdi").value.trim();

    if (kod === "" || ad === "") {
        alert("Kalıp kodu ve adı zorunlu.");
        return;
    }

    let operasyonAdi = kod + " - " + ad;

    /* =========================
       DUPLICATE KONTROL
    ========================= */

    const { data: mevcutlar, error: kontrolError } = await supabaseClient
        .from("operations")
        .select("*")
        .ilike("operasyon_adi", operasyonAdi);

    if (kontrolError) {
        console.log(kontrolError);
        alert("Kontrol hatası.");
        return;
    }

    if (mevcutlar.length > 0) {
        alert("Bu kalıp zaten kayıtlı.");
        return;
    }

    /* =========================
       EKLE
    ========================= */

    const { error } = await supabaseClient
        .from("operations")
        .insert([
            {
                operasyon_adi: operasyonAdi,
                aktif: true,
                bolum: "Enjeksiyon"
            }
        ]);

    if (error) {
        console.log(error);
        alert("Kalıp eklenemedi: " + error.message);
        return;
    }

    document.getElementById("kalipKodu").value = "";
    document.getElementById("kalipAdi").value = "";

    alert("Kalıp eklendi.");

    ekraniYenile();
}

/* =========================
   TOPLU KALIP EKLE
   Format: Kod;Ad
========================= */

async function topluKalipEkle() {
    let veri = document.getElementById("topluKalip").value;

    if (veri.trim() === "") {
        alert("Veri yok.");
        return;
    }

    let satirlar = veri.split("\n");
    let kayitlar = [];

    satirlar.forEach(function (satir) {
        let parca = satir.split(";");

        if (parca.length >= 2) {
            let kod = parca[0].trim();
            let ad = parca[1].trim();

            if (kod !== "" && ad !== "") {
                kayitlar.push({
                    operasyon_adi: kod + " - " + ad,
                    aktif: true
                });
            }
        }
    });

    if (kayitlar.length === 0) {
        alert("Geçerli kalıp verisi bulunamadı.");
        return;
    }

    const { error } = await supabaseClient
        .from("operations")
        .insert(kayitlar);

    if (error) {
        console.log(error);
        alert("Toplu kalıp ekleme hatası: " + error.message);
        return;
    }

    document.getElementById("topluKalip").value = "";

    alert(kayitlar.length + " kalıp eklendi.");

    ekraniYenile();
}

/* =========================
   KALIPLARI GÖSTER
========================= */

async function kaliplariGoster() {

    let div = document.getElementById("kalipListesi");

    if (!div) return;

    let arama = document
        .getElementById("kalipArama")
        ?.value
        .toLowerCase() || "";

    div.innerHTML = "Yükleniyor...";

    const { data, error } = await supabaseClient
        .from("operations")
        .select("*")
        .order("operasyon_adi", { ascending: true });

    if (error) {
        console.log(error);
        div.innerHTML = "Kalıplar yüklenemedi.";
        return;
    }

    div.innerHTML = "";

    let filtreli = data.filter(function (k) {

        return k.operasyon_adi
            ?.toLowerCase()
            .includes(arama);
    });

    if (filtreli.length === 0) {
        div.innerHTML = "Kalıp bulunamadı.";
        return;
    }

    filtreli.forEach(function (k) {

        div.innerHTML += `
            <div class="kalip-card">

                <strong>${k.operasyon_adi}</strong>

                <br><br>

                <button 
                    class="delete-btn"
                    onclick="kalipSil(${k.id})">

                    Sil

                </button>

            </div>
        `;
    });
}

/* =========================
   KALIP SİL
========================= */

async function kalipSil(id) {
    if (!confirm("Bu kalıbı silmek istiyor musun?")) return;

    const { error } = await supabaseClient
        .from("operations")
        .delete()
        .eq("id", id);

    if (error) {
        console.log(error);
        alert("Kalıp silinemedi: " + error.message);
        return;
    }

    ekraniYenile();
}

/* =========================
   SEÇİMLERİ DOLDUR
========================= */

async function secimleriDoldur() {
    let opSelect = document.getElementById("yetkinlikOperator");
    let kalipSelect = document.getElementById("yetkinlikKalip");

    if (!opSelect || !kalipSelect) return;

    opSelect.innerHTML = `<option value="">Operatör Seç</option>`;
    kalipSelect.innerHTML = `<option value="">Kalıp Seç</option>`;

    const { data: operatorler } = await supabaseClient
        .from("operators")
        .select("*")
        .order("ad_soyad", { ascending: true });

    if (operatorler) {
        operatorler.forEach(function (op) {
            opSelect.innerHTML += `
                <option value="${op.id}">
                    ${op.ad_soyad} - ${op.sicil_no}
                </option>
            `;
        });
    }

    const { data: kaliplar } = await supabaseClient
        .from("operations")
        .select("*")
        .order("operasyon_adi", { ascending: true });

    if (kaliplar) {
        kaliplar.forEach(function (k) {
            kalipSelect.innerHTML += `
                <option value="${k.id}">
                    ${k.operasyon_adi}
                </option>
            `;
        });
    }
}

/* =========================
   YETKİNLİK EKLE
========================= */

async function yetkinlikEkle() {
    let operatorId = Number(document.getElementById("yetkinlikOperator").value);
    let kalipId = Number(document.getElementById("yetkinlikKalip").value);
    let seviye = Number(document.getElementById("yetkinlikSeviye").value);

    if (!operatorId || !kalipId || !seviye) {
        alert("Operatör, kalıp ve seviye seç.");
        return;
    }

    const { error } = await supabaseClient
        .from("skills")
        .upsert([
            {
                operator_id: operatorId,
                operation_id: kalipId,
                seviye: seviye
            }
        ], {
            onConflict: "operator_id,operation_id"
        });

    if (error) {
        console.log(error);
        alert("Yetkinlik kaydedilemedi: " + error.message);
        return;
    }

    alert("Yetkinlik kaydedildi / güncellendi.");

    ekraniYenile();
}

/* =========================
   YETKİNLİKLERİ GÖSTER
========================= */

/* =========================
   YETKİNLİKLERİ GÖSTER
========================= */

async function yetkinlikleriGoster() {
    let div = document.getElementById("yetkinlikListesi");

    if (!div) return;

    div.innerHTML = "Yükleniyor...";

    const { data, error } = await supabaseClient
        .from("skills")
        .select(`
            id,
            operator_id,
            operation_id,
            seviye,
            operators (
                ad_soyad,
                sicil_no,
                unvan
            ),
            operations (
                operasyon_adi
            )
        `)
        .order("id", { ascending: false });

    if (error) {
        console.log(error);
        div.innerHTML = "Yetkinlikler yüklenemedi.";
        return;
    }

    div.innerHTML = "";

    if (!data || data.length === 0) {
        div.innerHTML = "Kayıtlı yetkinlik yok.";
        return;
    }

    data.forEach(function (y) {

        div.innerHTML += `
            <div class="kalip-card">

                <strong>${y.operators?.ad_soyad || ""}</strong><br>

                Sicil: ${y.operators?.sicil_no || ""}<br>

                Ünvan: ${y.operators?.unvan || "-"}<br>

                Kalıp: ${y.operations?.operasyon_adi || ""}<br><br>

                <div class="seviye-badge seviye-${y.seviye}">
                    ${seviyeAciklamasi(y.seviye)}
                </div>

                ${Number(y.seviye) < 4 ? `
                    <button 
                        class="levelup-btn"
                        onclick="event.stopPropagation(); seviyeYukseltModalAc(
                            ${y.id},
                            ${y.operator_id},
                            ${y.operation_id},
                            ${y.seviye}
                        )">
                        Seviye ${Number(y.seviye) + 1}'e Yükselt
                    </button>
                ` : ""}

                <br><br>

                <button 
                    class="delete-btn"
                    onclick="yetkinlikSil(${y.id})">
                    Sil
                </button>

            </div>
        `;
    });
}

/* =========================
   YETKİNLİK SİL
========================= */

async function yetkinlikSil(id) {
    if (!confirm("Bu yetkinliği silmek istiyor musun?")) return;

    const { error } = await supabaseClient
        .from("skills")
        .delete()
        .eq("id", id);

    if (error) {
        console.log(error);
        alert("Yetkinlik silinemedi: " + error.message);
        return;
    }

    ekraniYenile();
}

/* =========================
   KALIBA GÖRE OPERATÖR ARA
========================= */

async function kalibaGoreOperatorAra() {
    let aranan = document.getElementById("aramaKalipKodu").value.trim().toLowerCase();
    let sonuc = document.getElementById("sonucListesi");

    sonuc.innerHTML = "";

    if (aranan === "") {
        sonuc.innerHTML = "Kalıp kodu gir.";
        return;
    }

    const { data, error } = await supabaseClient
        .from("skills")
        .select(`
            id,
            operator_id,
            operation_id,
            seviye,
            operators (
                ad_soyad,
                sicil_no,
                resim
            ),
            operations (
                operasyon_adi
            )
        `)
        .gte("seviye", 1);

    if (error) {
        console.log(error);
        sonuc.innerHTML = "Arama hatası.";
        return;
    }

    let uygunlar = data.filter(function (y) {
        return y.operations?.operasyon_adi
            ?.toLowerCase()
            .includes(aranan);
    });

    if (uygunlar.length === 0) {
        sonuc.innerHTML = "Bu kalıp için uygun operatör bulunamadı.";
        return;
    }

    let kalipAdi = uygunlar[0]?.operations?.operasyon_adi || "";

    sonuc.innerHTML = `
        <div class="result-title">
            ${kalipAdi}
        </div>
    `;

    uygunlar.forEach(function (y) {

        let foto = y.operators?.resim
            ? y.operators.resim
            : "default-user.png";

        sonuc.innerHTML += `
            <div class="operator-card result-card">

                <img src="${foto}" class="operator-photo">

                <div class="operator-info">

                    <h3>${y.operators?.ad_soyad || ""}</h3>

                    <p><strong>Sicil:</strong> ${y.operators?.sicil_no || ""}</p>

                    <div class="seviye-badge seviye-${y.seviye}">
                        ${seviyeAciklamasi(y.seviye)}
                    </div>
${Number(y.seviye) < 4 ? `
    <button 
        class="levelup-btn"
        onclick="event.stopPropagation(); seviyeYukseltModalAc(
            ${y.id},
            ${y.operator_id},
            ${y.operation_id},
            ${y.seviye}
        )">
        Seviye ${Number(y.seviye) + 1}'e Yükselt
    </button>
` : ""}
                </div>

            </div>
        `;
    });
}
function kalipDropdownFiltrele() {

    let input = document
        .getElementById("kalipSearch")
        .value
        .toLowerCase();

    let select = document.getElementById("yetkinlikKalip");

    for (let i = 0; i < select.options.length; i++) {

        let txt = select.options[i].text.toLowerCase();

        if (txt.includes(input)) {
            select.options[i].style.display = "";
        } else {
            select.options[i].style.display = "none";
        }
    }
}
let tumKaliplar = [];

async function kaliplariBellegeAl() {
    const { data, error } = await supabaseClient
        .from("operations")
        .select("*")
        .order("operasyon_adi", { ascending: true });

    if (!error && data) {
        tumKaliplar = data;
    }
}

function kalipAutocomplete() {
    let input = document.getElementById("kalipSearch");
    let liste = document.getElementById("kalipOneriListesi");
    let hidden = document.getElementById("yetkinlikKalip");

    let arama = input.value.toLowerCase();

    liste.innerHTML = "";
    hidden.value = "";

    if (arama.length < 2) return;

    let bulunanlar = tumKaliplar
        .filter(k => k.operasyon_adi.toLowerCase().includes(arama))
        .slice(0, 20);

    bulunanlar.forEach(k => {
        let item = document.createElement("div");
        item.className = "autocomplete-item";
        item.innerText = k.operasyon_adi;

        item.onclick = function () {
            input.value = k.operasyon_adi;
            hidden.value = k.id;
            liste.innerHTML = "";
        };

        liste.appendChild(item);
    });
}
let tumOperatorler = [];

async function operatorleriBellegeAl() {
    const { data, error } = await supabaseClient
        .from("operators")
        .select("*")
        .order("sicil_no", { ascending: true });

    if (!error && data) {
        tumOperatorler = data;
    }
}

function operatorAutocomplete() {
    let input = document.getElementById("operatorSearch");
    let liste = document.getElementById("operatorOneriListesi");
    let hidden = document.getElementById("yetkinlikOperator");

    let arama = input.value.toLowerCase();

    liste.innerHTML = "";
    hidden.value = "";

    if (arama.length < 2) return;

    let bulunanlar = tumOperatorler
        .filter(op =>
            op.sicil_no.toLowerCase().includes(arama) ||
            op.ad_soyad.toLowerCase().includes(arama)
        )
        .slice(0, 20);

    bulunanlar.forEach(op => {
        let item = document.createElement("div");
        item.className = "autocomplete-item";
        item.innerText = op.sicil_no + " - " + op.ad_soyad + " - " + (op.unvan || "");

        item.onclick = function () {
            input.value = op.sicil_no + " - " + op.ad_soyad;
            hidden.value = op.id;
            liste.innerHTML = "";
        };

        liste.appendChild(item);
    });
}
/* =========================
   YENİ ANA EKRAN / MENÜ
========================= */



function menuAcKapat() {
    let menu = document.getElementById("dropdownMenu");
    if (!menu) return;

    if (window.getComputedStyle(menu).display === "none") {
        menu.style.display = "block";
    } else {
        menu.style.display = "none";
    }
}

function sayfaAc(sayfaId) {
    // Ana ekran harici sayfalara girişte yetki kontrolü
    const pagePermissions = {
        "operatorPanel": "can_access_operators",
        "kalipPanel": "can_access_kalip",
        "yetkinlikPanel": "can_access_yetkinlik",
        "yetkiliPanel": "can_access_yetkili"
    };

    if (sayfaId !== "anaEkran") {
        if (!currentAuthorizer) { // Hiç kimse giriş yapmamışsa
            adminGirisModalAc(); // Giriş modalını aç
            targetSayfa = sayfaId; // Giriş yapıldıktan sonra gidilecek sayfayı kaydet
            return; // Sayfa açma işlemini durdur
        }

        // Giriş yapılmışsa, genel yönetici yetkisi veya spesifik sayfa yetkisini kontrol et
        const requiredPermission = pagePermissions[sayfaId];
        if (requiredPermission && !currentAuthorizer.can_manage && !currentAuthorizer[requiredPermission]) {
            alert("Bu sayfaya erişim yetkiniz bulunmamaktadır.");
            return; // Sayfa açma işlemini durdur
        }
    }

    // Yetkilendirme başarılıysa veya ana ekransa sayfayı aç
    let sayfalar = document.getElementsByClassName("page");

    for (let i = 0; i < sayfalar.length; i++) {
        sayfalar[i].style.display = "none"; // Tüm sayfaları gizle
    }

    document.getElementById(sayfaId).style.display = "block"; // İstenen sayfayı göster

    let menu = document.getElementById("dropdownMenu");
    if (menu) {
        menu.style.display = "none"; // Menüyü kapat
    }

    localStorage.setItem("aktifSayfa", sayfaId); // Son açılan sayfayı kaydet

    // Sayfa her açıldığında veya menüden geçiş yapıldığında verileri tazelemek için çağırıyoruz.
    ekraniYenile();
}


/* =========================
   ANA EKRAN KALIP AUTOCOMPLETE
========================= */

function mainKalipAutocomplete() {
    let input = document.getElementById("mainKalipSearch");
    let liste = document.getElementById("mainKalipOneriListesi");
    let hidden = document.getElementById("mainSelectedKalip");

    let arama = input.value.toLowerCase();

    liste.innerHTML = "";
    hidden.value = "";

    if (arama.length < 2) return;

    let bulunanlar = tumKaliplar
        .filter(k => k.operasyon_adi.toLowerCase().includes(arama))
        .slice(0, 20);

    bulunanlar.forEach(k => {
        let item = document.createElement("div");
        item.className = "autocomplete-item";
        item.innerText = k.operasyon_adi;

        item.onclick = function () {
            input.value = k.operasyon_adi;
            hidden.value = k.id;
            liste.innerHTML = "";
        };

        liste.appendChild(item);
    });
}

/* =========================
   ANA EKRAN OPERATÖR GETİR
========================= */

async function kalipOperatorleriniGetir() {
    let kalipId = Number(document.getElementById("mainSelectedKalip").value);
    let sonuc = document.getElementById("operatorSonuclari");
    let searchBtn = document.querySelector(".main-search-button");

    sonuc.innerHTML = "";

    if (!kalipId) {
        sonuc.innerHTML = `<div class="panel-card">Lütfen listeden bir kalıp seç.</div>`;
        return;
    }

    // Görsel geri bildirim: Butonu geçici olarak pasifleştir
    if (searchBtn) {
        searchBtn.innerText = "Sorgulanıyor...";
        searchBtn.style.opacity = "0.7";
    }

    const { data, error } = await supabaseClient
        .from("skills")
        .select(`
            id,
            operator_id,
            operation_id,
            seviye,
            operators (
                ad_soyad,
                sicil_no,
                unvan,
                resim
            ),
            operations (
                operasyon_adi
            )
        `)
        .eq("operation_id", kalipId)
        .order("seviye", { ascending: false });

    if (searchBtn) {
        searchBtn.innerText = "→ ARA";
        searchBtn.style.opacity = "1";
    }

    if (error) {
        console.log(error);
        sonuc.innerHTML = `<div class="panel-card">Arama hatası oluştu.</div>`;
        return;
    }

    if (!data || data.length === 0) {
        sonuc.innerHTML = `<div class="panel-card">Bu kalıp için kayıtlı operatör bulunamadı.</div>`;
        return;
    }

    data.forEach(kayit => {

    let foto = kayit.operators?.resim 
        ? kayit.operators.resim 
        : "default-user.png";

    sonuc.innerHTML += `
    <div class="operator-card result-card">

        <img src="${foto}" class="operator-photo">

        <div class="operator-info">

            <h3>${kayit.operators?.ad_soyad || ""}</h3>

            <p>Sicil: ${kayit.operators?.sicil_no || ""}</p>

            <div class="seviye-badge seviye-${kayit.seviye}">
                ${seviyeAciklamasi(kayit.seviye)}
            </div>

            ${Number(kayit.seviye) < 4 ? `
                <button 
                    class="levelup-btn"
                    onclick="event.stopPropagation(); seviyeYukseltModalAc(
                        ${kayit.id},
                        ${kayit.operator_id},
                        ${kayit.operation_id},
                        ${kayit.seviye}
                    )">
                    Seviye ${Number(kayit.seviye) + 1}'e Yükselt
                </button>
            ` : ""}

        </div>

    </div>
`;
});

    // Sayfayı sonuçların olduğu yere yumuşak bir şekilde kaydır
    setTimeout(() => {
    const aramaPaneli = document.querySelector(".main-search-panel");

    const panelYuksekligi = aramaPaneli ? aramaPaneli.offsetHeight : 0;

    const hedefKonum =
        sonuc.getBoundingClientRect().top +
        window.scrollY -
        panelYuksekligi -
        30;

    window.scrollTo({
        top: hedefKonum,
        behavior: "smooth"
    });
}, 150);
}
function seviyeAciklamasi(seviye) {

    switch (Number(seviye)) {

        case 1:
            return "SEVİYE 1 • TALİMAT İLE ÇALIŞIR";

        case 2:
            return "SEVİYE 2 • KONTROLLÜ ÇALIŞIR";

        case 3:
            return "SEVİYE 3 • BAĞIMSIZ ÇALIŞIR";

        case 4:
            return "SEVİYE 4 • EĞİTİCİ / USTA";

        default:
            return "SEVİYE YOK";
    }
}
/* =========================
   OPERATÖR DETAY MODAL
========================= */

async function operatorDetayAc(operatorId) {
    let modal = document.getElementById("operatorDetayModal");
    let icerik = document.getElementById("operatorDetayIcerik");

    modal.style.display = "flex";
    icerik.innerHTML = "Yükleniyor...";

    const { data: operator, error: opError } = await supabaseClient
        .from("operators")
        .select("*")
        .eq("id", operatorId)
        .single();

    if (opError) {
        console.log(opError);
        icerik.innerHTML = "Operatör bilgisi alınamadı.";
        return;
    }

    const { data: yetkinlikler, error: yetError } = await supabaseClient
        .from("skills")
        .select(`
            seviye,
            operations (
                operasyon_adi
            )
        `)
        .eq("operator_id", operatorId)
        .order("seviye", { ascending: false });

    if (yetError) {
        console.log(yetError);
        icerik.innerHTML = "Yetkinlik bilgileri alınamadı.";
        return;
    }

    const { data: logs, error: logError } = await supabaseClient
        .from("skill_logs")
        .select(`
            created_at,
            old_seviye,
            new_seviye,
            authorizer,
            operations (operasyon_adi)
        `)
        .eq("operator_id", operatorId)
        .order("created_at", { ascending: false });

    let foto = operator.resim ? operator.resim : "default-user.png";

    let kalipHtml = "";

    if (!yetkinlikler || yetkinlikler.length === 0) {
        kalipHtml = `<p>Bu operatör için kayıtlı yetkinlik yok.</p>`;
    } else {
        yetkinlikler.forEach(y => {
            kalipHtml += `
                <div class="operator-skill-row">
                    <span>${y.operations?.operasyon_adi || ""}</span>

                    <div class="seviye-badge seviye-${y.seviye}">
                        ${seviyeAciklamasi(y.seviye)}
                    </div>
                </div>
            `;
        });
    }

    let logHtml = "";
    if (!logs || logs.length === 0) {
        logHtml = `<p style="color: #64748b; font-size: 14px;">Henüz bir gelişim kaydı bulunmuyor.</p>`;
    } else {
        logs.forEach(l => {
            let tarih = new Date(l.created_at).toLocaleString("tr-TR");
            logHtml += `
                <div class="log-item">
                    <div class="log-date">${tarih}</div>
                    <div class="log-text">
                        <strong>${l.operations?.operasyon_adi}</strong>: Seviye ${l.old_seviye} ➔ ${l.new_seviye} yükseltildi. <br>
                        <small>Onaylayan: ${l.authorizer}</small>
                    </div>
                </div>
            `;
        });
    }

    icerik.innerHTML = `
        <div class="operator-detail-header">
            <img src="${foto}" class="operator-detail-photo">

            <div>
                <h2>${operator.ad_soyad}</h2>
                <p><strong>Sicil:</strong> ${operator.sicil_no}</p>
                <p><strong>Ünvan:</strong> ${operator.unvan || "-"}</p>
            </div>
        </div>

        <h3>Çalışabileceği Kalıplar</h3>

        <div class="operator-skill-list">
            ${kalipHtml}
        </div>

        <h3 style="margin-top: 30px; border-top: 1px solid #eee; pt: 20px;">Gelişim Geçmişi</h3>

        <div class="log-list">
            ${logHtml}
        </div>
    `;
}

function operatorDetayKapat() {
    document.getElementById("operatorDetayModal").style.display = "none";
}
/* =========================
   YETKİNLİK CHECKLIST SORULARI
========================= */

const checklistSorulari = {
    1: [
        "Makinadaki emniyet noktalarını biliyor mu? (Acil stop, robot eli koruma kapağı)",
        "Gerekli durumlarda kişisel koruyucu ekipmanları kullanıyor mu? (Ayakkabı, eldiven, gözlük vb.)",
        "Ürün ağacı haricinde yabancı cisim olmadığını kontrol ediyor mu? (Kişisel eşya, yiyecek vb.)",
        "Yerleşim planına ve çalışma talimatlarına uyuyor mu?",
        "Ürünleri ambalaj talimatına / çalışma talimatlarına uygun gerçekleştiriyor mu?",
        "Etiket parça doğrulamasını uygun şekilde yapıyor mu?",
        "Uygun olmayan parçayı ayırt edebiliyor mu?",
        "Red parçaların hatalı bölgesini işaretleyerek red kasasına atıyor mu?",
        "Dur-Çağır-Bekle kuralını biliyor ve uyguluyor mu?",
        "Vardiya teslim alırken sorunları soruyor, devrederken sorunları aktarıyor mu?",
        "PC panel kayıtlarını doğru dolduruyor mu?"
    ],

    2: [
        "Başlangıç onay parçaları ile üretilen parçayı kıyaslayabiliyor mu?",
        "POKA-YOKE işlemi olan proseslerde sistemi doğru kullanıyor mu?",
        "Hatalı parça örneklerini ve şahit numuneleri biliyor / tanıyor mu?",
        "Ürünün kritik kabul seviyesini kalite açısından biliyor mu?",
        "Uygun olmayan parçanın bütün hatalarını bulabiliyor mu?",
        "Ürünlerinin kontrolünü gerçekleştiriyor ve kontrol araçlarını kullanabiliyor mu?"
    ],

    3: [
        "Üretilmesi gereken miktara bağımsız olarak uyuyor mu?",
        "Kasa içi adet ile gerçekleşen adet uyumunu sağlıyor mu?",
        "Standartlara dönmek için ortaya çıkan problemleri biliyor ve çözüme kavuşturuyor mu?"
    ],

    4: [
        "Operatörlere teknik destekte bulunuyor mu?",
        "Operatörlerin eğitimini verebiliyor, gerçekleştiriyor ve eğitim ihtiyaçlarını çıkarabiliyor mu?",
        "Standartları geliştirmek amacıyla herhangi bir öneride bulundu mu?"
    ]
};

/* =========================
   YETKİNLİK SEVİYE YÜKSELTME MODAL MANTIĞI
========================= */

async function seviyeYukseltModalAc(skillId, operatorId, operationId, mevcutSeviye) {
    let hedefSeviye = Number(mevcutSeviye) + 1;
    let modal = document.getElementById("seviyeYukseltModal");

    // Eğer modal HTML'de yoksa, otomatik olarak oluştur (Sistemin çökmesini engeller)
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "seviyeYukseltModal";
        modal.className = "operator-modal"; // Daha güçlü olan modal sınıfını kullanıyoruz
        modal.style.display = "none";
        modal.innerHTML = '<div id="seviyeYukseltIcerik" class="operator-modal-content"></div>';
        document.body.appendChild(modal);
        
        modal.onclick = function(e) {
            if (e.target === modal) seviyeYukseltModalKapat();
        };
    }

    let icerik = document.getElementById("seviyeYukseltIcerik");

    let sorular = checklistSorulari[hedefSeviye] || [];
    let html = `
        <button class="modal-close" onclick="seviyeYukseltModalKapat()">×</button>
        <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="font-size: 32px; color: #08244d; margin-bottom: 8px;">Seviye ${hedefSeviye} Onay Formu</h2>
            <p style="color: #62718a; font-size: 16px;">Operatörün bu seviyeye geçmesi için tüm kriterler doğrulanmalıdır.</p>
        </div>
        <div style="background: #f0f4f9; padding: 2px; border-radius: 12px; margin-bottom: 20px;"></div>

        <div class="checklist-container" style="max-height: 400px; overflow-y: auto; text-align: left; padding: 15px;">
    `;

    sorular.forEach((soru, index) => {
        html += `
            <div class="checklist-item" style="margin-bottom: 12px; display: flex; align-items: flex-start;">
                <input type="checkbox" id="soru_${index}" class="checklist-check" style="margin-right: 12px; margin-top: 4px; width: 18px; height: 18px; cursor: pointer;">
                <label for="soru_${index}" style="cursor: pointer; font-size: 14px; line-height: 1.4;">${soru}</label>
            </div>
        `;
    });

    html += `
        </div>
        <hr>
        <div style="margin-top: 15px; text-align: center; padding: 10px; background: #fff5f5; border-radius: 12px; border: 1px solid #fed7d7;">
            <p style="font-weight: bold; color: #c53030; margin-bottom: 8px; font-size: 14px;">⚠️ YETKİLİ ONAYI GEREKLİ</p>
            <input type="text" id="authSicil" placeholder="Yetkili Sicil No" 
                   style="width: 240px; text-align: center; font-size: 14px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 8px;">
            <input type="password" id="authPin" placeholder="Onay PIN Kodu" 
                   style="width: 240px; text-align: center; font-size: 14px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 0;">
        </div>
        <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
            <button class="save-btn" onclick="seviyeYukseltKaydet(${skillId}, ${hedefSeviye}, ${operatorId}, ${operationId})">
                Doğrula ve Seviye Atlat
            </button>
            <button class="delete-btn" onclick="seviyeYukseltModalKapat()">
                Vazgeç
            </button>
        </div>
    `;

    icerik.innerHTML = html;
    modal.style.display = "flex"; // İçerik dolduktan sonra göster
}

async function seviyeYukseltKaydet(skillId, yeniSeviye, operatorId, operationId) {
    let checks = document.querySelectorAll(".checklist-check");
    let hepsiSecili = true;

    checks.forEach(c => { if (!c.checked) hepsiSecili = false; });

    if (!hepsiSecili) {
        alert("Lütfen seviye yükseltme için tüm kriterleri kontrol edip onaylayın.");
        return;
    }

    let sicil = document.getElementById("authSicil").value.trim();
    let pin = document.getElementById("authPin").value;

    if (!sicil || !pin) {
        alert("Yetkili sicil no ve PIN kodu gereklidir.");
        return;
    }

    // Yetkiliyi Veritabanından Doğrula
    const { data: authorizer, error: authError } = await supabaseClient
        .from("authorizers")
        .select("ad_soyad")
        .eq("sicil_no", sicil)
        .eq("pin", pin)
        .single();

    if (authError || !authorizer) {
        alert("Yetkili doğrulaması başarısız! Sicil no veya PIN hatalı.");
        return;
    }

    let yetkiliAdi = authorizer.ad_soyad;

    // 1. Yetkinlik Seviyesini Güncelle
    const { error: updateError } = await supabaseClient
        .from("skills")
        .update({ seviye: yeniSeviye })
        .eq("id", skillId);

    if (updateError) {
        console.log(updateError);
        alert("Güncelleme hatası: " + updateError.message);
        return;
    }

    // 2. İşlemi Log Tablosuna Kaydet
    const { error: logError } = await supabaseClient
        .from("skill_logs")
        .insert([{
            skill_id: skillId,
            operator_id: operatorId,
            operation_id: operationId,
            old_seviye: yeniSeviye - 1,
            new_seviye: yeniSeviye,
            authorizer: yetkiliAdi
        }]);

    if (logError) console.error("Log kaydı oluşturulamadı:", logError);

    alert("Tebrikler! Yetkinlik seviyesi başarıyla yükseltildi.");
    seviyeYukseltModalKapat();
    
    // Tüm ekranları ve aktif arama sonuçlarını tazele
    ekraniYenile(); 
    kalipOperatorleriniGetir(); 
    kalibaGoreOperatorAra();
}

function seviyeYukseltModalKapat() {
    let modal = document.getElementById("seviyeYukseltModal");
    if (modal) modal.style.display = "none";
}

/* =========================
   YÖNETİCİ GİRİŞ MANTIĞI
========================= */

function adminGirisModalAc() {
    document.getElementById("adminGirisModal").style.display = "flex";
    document.getElementById("adminSicil").value = "";
    document.getElementById("adminPin").value = "";
}

function adminGirisModalKapat() {
    document.getElementById("adminGirisModal").style.display = "none";
}

async function adminGirisYap() {
    let sicil = document.getElementById("adminSicil").value.trim();
    let pin = document.getElementById("adminPin").value;

    if (!sicil || !pin) {
        alert("Lütfen tüm alanları doldurun.");
        return;
    }

    const { data, error } = await supabaseClient
        .from("authorizers")
        .select("*")
        .eq("sicil_no", sicil)
        .eq("pin", pin)
        .single();

    if (error || !data) {
        alert("Yetkisiz giriş veya hatalı bilgiler! Sadece yönetici yetkisi olanlar girebilir.");
        return;
    }

    // Yetkilinin herhangi bir yönetim yetkisi olup olmadığını kontrol et
    // Eğer hiçbir yetkisi yoksa giriş yapamaz.
    if (!data.can_manage && !data.can_access_operators && !data.can_access_kalip && !data.can_access_yetkinlik && !data.can_access_yetkili) {
        alert("Bu yetkilinin herhangi bir yönetim paneline erişim yetkisi bulunmamaktadır.");
        return;
    }

    currentAuthorizer = data; // Yetkili bilgisini kaydet
    isAuthorized = true; // Oturumu yetkilendir
    oturumBilgisiGuncelle();
    resetSessionTimer(); // Zamanlayıcıyı başlat
    menuYetkileriniUygula();
    adminGirisModalKapat();

    if (targetSayfa) {
        const tempTargetSayfa = targetSayfa; // Geçici olarak sakla
        targetSayfa = null;
        sayfaAc(tempTargetSayfa); // Hedef sayfayı aç
    }
}

/* =========================
   YETKİLİ (AUTHORIZER) YÖNETİMİ
========================= */

async function yetkiliEkle() {
    let sicil = document.getElementById("yeniYetkiliSicil").value.trim();
    let adSoyad = document.getElementById("yeniYetkiliAd").value.trim();
    let pin = document.getElementById("yeniYetkiliPin").value.trim();
    let unvan = document.getElementById("yeniYetkiliUnvan").value.trim();
    let canManage = document.getElementById("yeniYetkiliCanManage")?.checked || false;
    // Yeni yetki alanları
    let canAccessOperators = document.getElementById("yeniYetkiliCanAccessOperators")?.checked || false;
    let canAccessKalip = document.getElementById("yeniYetkiliCanAccessKalip")?.checked || false;
    let canAccessYetkinlik = document.getElementById("yeniYetkiliCanAccessYetkinlik")?.checked || false;
    let canAccessYetkili = document.getElementById("yeniYetkiliCanAccessYetkili")?.checked || false;

    if (!sicil || !adSoyad || !pin) {
        alert("Sicil No, Ad Soyad ve PIN alanları zorunludur.");
        return;
    }

    const { error } = await supabaseClient
        .from("authorizers")
        .insert([{
            sicil_no: sicil,
            ad_soyad: adSoyad,
            pin: pin,
            unvan: unvan,
            can_manage: canManage,
            can_access_operators: canAccessOperators,
            can_access_kalip: canAccessKalip,
            can_access_yetkinlik: canAccessYetkinlik,
            can_access_yetkili: canAccessYetkili
        }]);

    if (error) {
        alert("Yetkili eklenemedi: " + error.message);
        return;
    }

    alert("Yetkili başarıyla kaydedildi.");
    ekraniYenile();
    
    // Formu temizle
    document.getElementById("yeniYetkiliSicil").value = "";
    document.getElementById("yeniYetkiliAd").value = "";
    document.getElementById("yeniYetkiliPin").value = "";
    document.getElementById("yeniYetkiliUnvan").value = "";
    if(document.getElementById("yeniYetkiliCanManage")) document.getElementById("yeniYetkiliCanManage").checked = false; // Genel yönetici yetkisini temizle
    if(document.getElementById("yeniYetkiliCanAccessOperators")) document.getElementById("yeniYetkiliCanAccessOperators").checked = false;
    if(document.getElementById("yeniYetkiliCanAccessKalip")) document.getElementById("yeniYetkiliCanAccessKalip").checked = false;
    if(document.getElementById("yeniYetkiliCanAccessYetkinlik")) document.getElementById("yeniYetkiliCanAccessYetkinlik").checked = false;
    if(document.getElementById("yeniYetkiliCanAccessYetkili")) document.getElementById("yeniYetkiliCanAccessYetkili").checked = false;
}

async function yetkilileriGoster() {
    let div = document.getElementById("yetkiliListesi");
    if (!div) return;

    const { data, error } = await supabaseClient
        .from("authorizers")
        .select("*")
        .order("ad_soyad", { ascending: true });

    if (error) return;

    div.innerHTML = "";
    data.forEach(y => {
        div.innerHTML += `
            <div class="kalip-card">
                <strong>${y.ad_soyad}</strong> (Sicil: ${y.sicil_no})<br>
                Ünvan: ${y.unvan || "-"}<br>
                PIN: **** <br>
                Yetkiler:
                <ul>
                    ${y.can_manage ? '<li>Genel Yönetici</li>' : ''}
                    ${y.can_access_operators ? '<li>Operatör Yönetimi</li>' : ''}
                    ${y.can_access_kalip ? '<li>Kalıp Yönetimi</li>' : ''}
                    ${y.can_access_yetkinlik ? '<li>Yetkinlik Tanımlama</li>' : ''}
                    ${y.can_access_yetkili ? '<li>Yetkili Yönetimi</li>' : ''}
                </ul>
                <button class="levelup-btn" style="margin-right: 5px; margin-bottom: 5px;" onclick="yetkiliDuzenleModalAc(${y.id})">Düzenle</button>
                <button class="delete-btn" onclick="yetkiliSil(${y.id})">Sil</button>
            </div>
        `;
    });
}

async function yetkiliSil(id) {
    if (!confirm("Bu yetkiliyi silmek istediğinize emin misiniz?")) return;

    const { error } = await supabaseClient
        .from("authorizers")
        .delete()
        .eq("id", id);

    if (error) {
        alert("Silme hatası: " + error.message);
        return;
    }
    ekraniYenile();
}

/* =========================
   YETKİLİ DÜZENLEME (MODAL)
========================= */

async function yetkiliDuzenleModalAc(id) {
    const { data: y, error } = await supabaseClient
        .from("authorizers")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !y) {
        alert("Yetkili bilgisi alınamadı.");
        return;
    }

    document.getElementById("editYetkiliId").value = y.id;
    document.getElementById("editYetkiliSicil").value = y.sicil_no;
    document.getElementById("editYetkiliAd").value = y.ad_soyad;
    document.getElementById("editYetkiliUnvan").value = y.unvan || "";
    document.getElementById("editYetkiliPin").value = ""; // PIN güvenliği için boş bırakıyoruz
    
    document.getElementById("editYetkiliCanManage").checked = y.can_manage;
    document.getElementById("editYetkiliCanAccessOperators").checked = y.can_access_operators;
    document.getElementById("editYetkiliCanAccessKalip").checked = y.can_access_kalip;
    document.getElementById("editYetkiliCanAccessYetkinlik").checked = y.can_access_yetkinlik;
    document.getElementById("editYetkiliCanAccessYetkili").checked = y.can_access_yetkili;

    document.getElementById("yetkiliDuzenleModal").style.display = "flex";
}

function yetkiliDuzenleModalKapat() {
    document.getElementById("yetkiliDuzenleModal").style.display = "none";
}

async function yetkiliGuncelle() {
    const id = document.getElementById("editYetkiliId").value;
    const sicil = document.getElementById("editYetkiliSicil").value.trim();
    const adSoyad = document.getElementById("editYetkiliAd").value.trim();
    const unvan = document.getElementById("editYetkiliUnvan").value.trim();
    const pin = document.getElementById("editYetkiliPin").value.trim();
    
    const canManage = document.getElementById("editYetkiliCanManage").checked;
    const canAccessOperators = document.getElementById("editYetkiliCanAccessOperators").checked;
    const canAccessKalip = document.getElementById("editYetkiliCanAccessKalip").checked;
    const canAccessYetkinlik = document.getElementById("editYetkiliCanAccessYetkinlik").checked;
    const canAccessYetkili = document.getElementById("editYetkiliCanAccessYetkili").checked;

    if (!sicil || !adSoyad) {
        alert("Sicil No ve Ad Soyad zorunludur.");
        return;
    }

    let updateData = {
        sicil_no: sicil,
        ad_soyad: adSoyad,
        unvan: unvan,
        can_manage: canManage,
        can_access_operators: canAccessOperators,
        can_access_kalip: canAccessKalip,
        can_access_yetkinlik: canAccessYetkinlik,
        can_access_yetkili: canAccessYetkili
    };

    if (pin !== "") {
        updateData.pin = pin;
    }

    const { error } = await supabaseClient
        .from("authorizers")
        .update(updateData)
        .eq("id", id);

    if (error) {
        alert("Güncelleme hatası: " + error.message);
        return;
    }

    alert("Yetkili bilgileri başarıyla güncellendi.");
    yetkiliDuzenleModalKapat();
    ekraniYenile();
}

/* =========================
   MENÜ YETKİLERİNİ UYGULA
========================= */

function menuYetkileriniUygula() {
    const pagePermissions = {
        "operatorPanel": "can_access_operators",
        "kalipPanel": "can_access_kalip",
        "yetkinlikPanel": "can_access_yetkinlik",
        "yetkiliPanel": "can_access_yetkili"
    };

    Object.keys(pagePermissions).forEach(pageId => {
        const btn = document.getElementById("menu-" + pageId);
        if (!btn) return;

        if (!currentAuthorizer) {
            // Giriş yapılmamışsa butonları gizle
            btn.style.display = "none";
        } else if (currentAuthorizer.can_manage) {
            // Genel yönetici ise her şeyi göster
            btn.style.display = "block";
        } else {
            // Spesifik yetkiye göre göster/gizle
            const permissionField = pagePermissions[pageId];
            if (currentAuthorizer[permissionField]) {
                btn.style.display = "block";
            } else {
                btn.style.display = "none";
            }
        }
    });
}

/* =========================
   OTURUM YÖNETİMİ
========================= */

function oturumBilgisiGuncelle() {
    const infoDiv = document.getElementById("userInfo");
    const loginBtn = document.getElementById("loginBtn");
    const mainMenuBtn = document.getElementById("mainMenuBtn");
    if (!infoDiv) return;

    if (currentAuthorizer) {
        infoDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; justify-content: center; text-align: left;">
                <div style="display: flex; align-items: center; gap: 5px; line-height: 1.1;">
                    <span>👤</span>
                    <span>${currentAuthorizer.ad_soyad}</span>
                </div>
                <div style="font-size: 10px; color: #64748b; margin-left: 20px; font-weight: 400; line-height: 1.1;">${currentAuthorizer.unvan || ""}</div>
            </div>
            <button onclick="oturumKapat()" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 11px; transition: 0.3s; font-weight: bold; height: fit-content;">Çıkış Yap</button>
        `;
        infoDiv.style.display = "flex";
        if (loginBtn) loginBtn.style.display = "none";
        if (mainMenuBtn) mainMenuBtn.style.display = "flex";
    } else {
        infoDiv.style.display = "none";
        if (loginBtn) loginBtn.style.display = "inline-flex";
        if (mainMenuBtn) mainMenuBtn.style.display = "none";
    }
}

function oturumKapat() {
    currentAuthorizer = null;
    isAuthorized = false;
    clearTimeout(sessionTimer); // Zamanlayıcıyı durdur
    oturumBilgisiGuncelle();
    menuYetkileriniUygula();
    sayfaAc('anaEkran');
    alert("Güvenli çıkış yapıldı.");
}

/* =========================
   OTOMATİK ÇIKIŞ (TIMEOUT)
========================= */

function resetSessionTimer() {
    if (!currentAuthorizer) return; // Oturum yoksa başlatma

    if (sessionTimer) clearTimeout(sessionTimer);
    
    sessionTimer = setTimeout(() => {
        alert("10 dakika boyunca işlem yapmadığınız için oturumunuz otomatik olarak sonlandırıldı.");
        oturumKapat();
    }, SESSION_TIMEOUT_MS);
}

function setupActivityListeners() {
    // Fare hareketi, klavye girişi veya tıklama olduğunda zamanlayıcıyı sıfırla
    const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    activities.forEach(name => {
        document.addEventListener(name, () => {
            if (currentAuthorizer) resetSessionTimer();
        }, true);
    });
}

/* =========================
   TARİH VE VARDİYA HESAPLAMA
========================= */

function tarihVardiyaGuncelle() {
    const dateElement = document.getElementById("headerDate");
    if (!dateElement) return;

    const simdi = new Date();
    const gunler = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const gunAdi = gunler[simdi.getDay()];
    const tarihStr = simdi.toLocaleDateString('tr-TR') + " " + gunAdi;
    
    const saat = simdi.getHours();
    let vardiya = "";

    if (saat >= 8 && saat < 16) vardiya = "08:00 - 16:00";
    else if (saat >= 16 && saat < 24) vardiya = "16:00 - 00:00";
    else vardiya = "00:00 - 08:00";

    dateElement.innerHTML = `
        <div style="font-size: 16px; font-weight: 700; color: #08244d;">📅 ${tarihStr}</div>
        <div style="font-size: 14px; font-weight: 600; color: #08244d;">🕒 Vardiya: ${vardiya}</div>
    `;
}
/* =========================
   OPERATÖR EKLE MODAL
========================= */

function operatorEkleModalAc() {
    document.getElementById("operatorEkleModal").style.display = "flex";
}

function operatorEkleModalKapat() {
    document.getElementById("operatorEkleModal").style.display = "none";
}