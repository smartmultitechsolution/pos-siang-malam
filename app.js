// ============================================
// KONFIGURASI API
// ============================================
const API_URL = "https://pos-siang-malam-api.smartmultitechsolution.workers.dev";

// Info restoran untuk struk
const RESTO_INFO = {
  nama: "RUMAH MAKAN PADANG",
  cabang: "SIANG MALAM",
  alamat: "Jl. Raya Padang No. 123",
  telp: "0751-123456",
  footer: "Terima kasih, selamat makan!"
};

// ============================================
// STATE GLOBAL
// ============================================
const state = {
  user: null,
  menuDB: {},
  mejaDB: [],
  selectedMeja: null,
  currentPage: "login",
  orderItems: [],
  orderMeja: null
};

let currentFilter = "today";
let currentRange = { mulai: "", akhir: "" };

const rp = (n) => "Rp " + Number(n).toLocaleString("id-ID");

// ============================================
// UTILITY
// ============================================
function toast(msg, type=""){
  const el=document.getElementById("toast");
  el.textContent=msg;
  el.className="toast show "+type;
  setTimeout(()=>el.className="toast "+type,2500);
}

function showModal(title,body,actions=null){
  document.getElementById("modalTitle").textContent=title;
  document.getElementById("modalBody").innerHTML=body;
  const actionsEl=document.getElementById("modalActions");
  actionsEl.innerHTML=actions||'<button class="btn-secondary" onclick="closeModal()">Tutup</button>';
  document.getElementById("modal").classList.add("show");
}

function closeModal(e){
  if(e&&e.target!==e.currentTarget&&e.target.id!=="modal")return;
  document.getElementById("modal").classList.remove("show");
}

function goTo(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const target=document.getElementById("page"+page.charAt(0).toUpperCase()+page.slice(1));
  if(target)target.classList.add("active");
  state.currentPage=page;
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  if(page==="home")loadLaporanDashboard();
  if(page==="meja")loadMeja();
  if(page==="voice")updateVoiceHeader();
  if(page==="laporan"){
    const btn = document.querySelector('.filter-tab[data-range="today"]');
    if(btn) setFilter("today", btn);
  }
  window.scrollTo(0,0);
}

async function apiCall(action,data={}){
  try{
    const res=await fetch(API_URL,{
      method:"POST",
      headers:{"Content-Type":"text/plain"},
      body:JSON.stringify({action,...data})
    });
    return await res.json();
  }catch(err){
    console.error("API Error:",err);
    return{success:false,message:"Gagal terhubung ke server"};
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================
function saveSession(){
  if(state.user){
    localStorage.setItem("pos_session", JSON.stringify({user:state.user,timestamp:Date.now()}));
  }
}

function loadSession(){
  try{
    const session=localStorage.getItem("pos_session");
    if(!session) return null;
    const data=JSON.parse(session);
    if(Date.now()-data.timestamp > 24*60*60*1000){
      localStorage.removeItem("pos_session");
      return null;
    }
    return data.user;
  }catch(e){return null;}
}

function clearSession(){localStorage.removeItem("pos_session");}

// ============================================
// LOGIN
// ============================================
async function doLogin(){
  const username=document.getElementById("inputUsername").value.trim();
  const pin=document.getElementById("inputPin").value.trim();
  if(!username||!pin){toast("Isi username dan PIN","error");return;}
  const btn=document.getElementById("btnLogin");
  btn.disabled=true;btn.textContent="Memproses...";
  const result=await apiCall("login",{username,pin});
  btn.disabled=false;btn.textContent="Masuk";
  if(!result.success){toast(result.message||"Login gagal","error");return;}
  state.user={username,nama:result.nama,role:result.role};
  saveSession();
  applyLoginUI();
  toast("Login berhasil! 🎉","success");
}

function applyLoginUI(){
  if(!state.user) return;
  document.getElementById("greeting").textContent="Halo, "+state.user.nama+"!";
  document.getElementById("userBadge").textContent=state.user.role;
  document.getElementById("bottomNav").style.display="flex";
  document.getElementById("pageLogin").classList.remove("active");
  loadMenuDB();
  goTo("home");
}

function logout(){
  showModal("Logout","Yakin ingin keluar?",
    '<button class="btn-secondary" onclick="closeModal()">Batal</button><button class="btn-primary" style="flex:1" onclick="confirmLogout()">Logout</button>');
}

function confirmLogout(){
  state.user=null;state.menuDB={};state.mejaDB=[];state.selectedMeja=null;state.orderItems=[];state.orderMeja=null;
  clearSession();
  document.getElementById("bottomNav").style.display="none";
  document.getElementById("inputUsername").value="";
  document.getElementById("inputPin").value="";
  closeModal();
  document.getElementById("pageLogin").classList.add("active");
  state.currentPage="login";
  toast("Anda telah logout");
}

// ============================================
// LOAD DATA
// ============================================
async function loadMenuDB(){
  const result=await apiCall("getMenu");
  if(result.success){
    state.menuDB={};
    result.data.forEach(item=>{
      state.menuDB[item.nama.toLowerCase()]={id:item.id,nama:item.nama,harga:item.harga,kategori:item.kategori};
    });
  }
}

async function loadLaporanDashboard(){
  const card=document.getElementById("cardLaporan");
  card.innerHTML='<div class="loading"><div class="spinner"></div><br>Memuat...</div>';
  const result=await apiCall("laporanHarian");
  if(!result.success){
    card.innerHTML="<h2>💰 Penjualan Hari Ini</h2><p>❌ "+result.message+"</p>";
    return;
  }
  card.innerHTML='<h2>💰 Penjualan Hari Ini <span style="font-size:11px;color:#888">'+result.tanggal+'</span></h2>'+
    '<div class="amount">'+rp(result.totalPenjualan)+'</div>'+
    '<div class="row-info"><span>Transaksi</span><strong>'+result.jumlahTransaksi+' pesanan</strong></div>'+
    '<div class="row-info"><span>💵 Tunai</span><strong>'+rp(result.breakdown.tunai)+'</strong></div>'+
    '<div class="row-info"><span>📱 QRIS</span><strong>'+rp(result.breakdown.qris)+'</strong></div>'+
    '<div class="row-info"><span>💳 Debit</span><strong>'+rp(result.breakdown.debit)+'</strong></div>';
}

async function loadMeja(){
  const grid=document.getElementById("gridMeja");
  grid.innerHTML='<div class="loading"><div class="spinner"></div><br>Memuat...</div>';
  const result=await apiCall("getMeja");
  if(!result.success){grid.innerHTML="❌ "+result.message;return;}
  state.mejaDB=result.data;
  let html="";
  result.data.forEach(meja=>{
    const cls=meja.status==="Kosong"?"kosong":"terisi";
    html+='<div class="meja-card '+cls+'" onclick="pilihMeja(\''+meja.no+'\',\''+meja.status+'\')">'+
      '<div class="meja-no">'+meja.no+'</div>'+
      '<div class="meja-status">'+meja.status+'</div></div>';
  });
  grid.innerHTML=html;
}

// ============================================
// PILIH MEJA
// ============================================
function pilihMeja(noMeja,status){
  if(status==="Terisi"){
    showModal("Meja Terisi",
      'Meja <strong>'+noMeja+'</strong> sedang terisi.<br><br>Ingin menambah pesanan?',
      '<button class="btn-secondary" onclick="closeModal()">Batal</button>'+
      '<button class="btn-primary" style="flex:1" onclick="tambahPesanan(\''+noMeja+'\')">Tambah Pesanan</button>');
  }else{
    state.selectedMeja=noMeja;
    state.orderMeja=noMeja;
    state.orderItems=[];
    toast("Meja "+noMeja+" dipilih","success");
    goTo("voice");
  }
}

function tambahPesanan(noMeja){
  state.selectedMeja=noMeja;
  state.orderMeja=noMeja;
  state.orderItems=[];
  closeModal();
  goTo("voice");
}

function startTakeaway(){
  state.selectedMeja=null;
  state.orderMeja=null;
  state.orderItems=[];
  toast("Mode Takeaway 🛍️","success");
  goTo("voice");
}

function updateVoiceHeader(){
  const info=document.getElementById("voiceHeaderInfo");
  if(state.orderMeja){
    info.textContent="🪑 Meja: "+state.orderMeja;
  }else{
    info.textContent="🛍️ Takeaway (Bungkus)";
  }
}

// ============================================
// DAFTAR MENU
// ============================================
function showDaftarMenu(){
  const menuArr=Object.values(state.menuDB);
  let html="";
  menuArr.forEach(m=>{
    html+='<div class="order-item"><div class="info"><strong>'+m.nama+'</strong><small>'+m.kategori+'</small></div>'+
      '<div style="color:#1a73e8;font-weight:700">'+rp(m.harga)+'</div></div>';
  });
  showModal("🍽️ Daftar Menu ("+menuArr.length+")",'<div style="max-height:60vh;overflow-y:auto">'+html+'</div>');
}

// ============================================
// PESANAN AKTIF
// ============================================
async function showPesananAktif(){
  showModal("📋 Pesanan Aktif",'<div class="loading"><div class="spinner"></div><br>Memuat...</div>');
  const result=await apiCall("pesananAktif");
  if(!result.success||!result.data||result.data.length===0){
    document.getElementById("modalBody").innerHTML="<p style='text-align:center;color:#888'>Tidak ada pesanan aktif</p>";
    return;
  }
  let html='<div style="max-height:60vh;overflow-y:auto">';
  result.data.forEach(p=>{
    const label=p.noMeja==="TAKEAWAY"?"🛍️ Takeaway":"🪑 "+p.noMeja;
    html+='<div class="order-item" onclick="lihatPesanan(\''+p.id+'\')" style="cursor:pointer">'+
      '<div class="info"><strong>'+label+'</strong>'+
      '<small>'+p.waktu+' • '+p.jumlahItem+' item</small></div>'+
      '<div style="color:#1a73e8;font-weight:700;font-size:13px">'+rp(p.total)+'</div></div>';
  });
  html+='</div>';
  document.getElementById("modalBody").innerHTML=html;
}

async function lihatPesanan(idPesanan){
  const result=await apiCall("detailPesanan",{idPesanan});
  if(!result.success){toast("Gagal memuat detail","error");return;}
  let html="";
  result.items.forEach(item=>{
    html+='<div class="order-item"><div class="info"><strong>'+item.nama+'</strong>'+
      '<small>'+rp(item.harga)+' × '+item.qty+'</small></div>'+
      '<div class="qty-badge">'+item.qty+'x</div></div>';
  });
  html+='<div class="total-box">Total: '+rp(result.total)+'</div>';
  showModal("Detail Pesanan",'<div style="max-height:50vh;overflow-y:auto">'+html+'</div>',
    '<button class="btn-secondary" onclick="closeModal()">Tutup</button>'+
    '<button class="btn-primary" style="flex:1" onclick="bayarPesanan(\''+idPesanan+'\','+result.total+')">Bayar</button>');
}

// ============================================
// VOICE INPUT
// ============================================
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null;
let isListening=false;

if(SpeechRecognition){
  recognition=new SpeechRecognition();
  recognition.lang="id-ID";
  recognition.continuous=false;
  recognition.interimResults=true;
  recognition.onresult=(event)=>{
    let transcript="";
    for(let i=event.resultIndex;i<event.results.length;i++){
      transcript+=event.results[i][0].transcript;
    }
    document.getElementById("transcript").textContent=transcript;
    if(event.results[event.results.length-1].isFinal){
      parseOrder(transcript);
    }
  };
  recognition.onend=()=>{
    isListening=false;
    document.getElementById("voiceBtn").classList.remove("listening");
    document.getElementById("voiceStatus").textContent="Tekan tombol untuk bicara lagi";
  };
  recognition.onerror=(event)=>{
    isListening=false;
    document.getElementById("voiceBtn").classList.remove("listening");
    document.getElementById("voiceStatus").textContent="❌ Error: "+event.error;
  };
}

function toggleVoice(){
  if(!recognition){toast("Browser tidak mendukung. Gunakan Chrome.","error");return;}
  if(isListening){recognition.stop();return;}
  recognition.start();
  isListening=true;
  document.getElementById("voiceBtn").classList.add("listening");
  document.getElementById("voiceStatus").textContent="🎙️ Mendengarkan... bicara sekarang";
  document.getElementById("transcript").textContent="...";
}

const angkaMap={"nol":0,"kosong":0,"satu":1,"dua":2,"tiga":3,"empat":4,"lima":5,"enam":6,"tujuh":7,"delapan":8,"sembilan":9,"sepuluh":10,"sebelas":11,"dua belas":12};

function parseAngka(teks){
  teks=teks.trim().toLowerCase();
  if(angkaMap[teks]!==undefined)return angkaMap[teks];
  const num=parseInt(teks);
  return isNaN(num)?null:num;
}

const ALIAS_MENU={"nasi":"nasi putih","rendang":"rendang daging","pop":"ayam pop","ayam goreng":"ayam goreng","dendeng":"dendeng balado","gulai ikan":"gulai ikan tongkol","tongkol":"gulai ikan tongkol","nangka":"sayur nangka","daun singkong":"daun singkong","tahu":"gulai tahu tempe","tempe":"gulai tahu tempe","perkedel":"perkedel","kerupuk":"kerupuk kulit","sambal":"sambal ijo","es teh":"es teh manis","teh manis":"es teh manis","teh talua":"teh talua","es jeruk":"es jeruk","air":"air mineral","aqua":"air mineral","kopi":"kopi hitam","es campur":"es campur"};

function cariMenu(input){
  input=input.toLowerCase().trim();
  if(state.menuDB[input])return state.menuDB[input];
  for(const alias in ALIAS_MENU){
    if(input.includes(alias)){
      const target=ALIAS_MENU[alias];
      if(state.menuDB[target])return state.menuDB[target];
    }
  }
  const menuNames=Object.keys(state.menuDB);
  for(const nama of menuNames){
    if(nama.includes(input)||input.includes(nama))return state.menuDB[nama];
  }
  const kataInput=input.split(/\s+/).filter(k=>k.length>2);
  let bestMatch=null;
  let bestScore=0;
  for(const nama of menuNames){
    let score=0;
    kataInput.forEach(kata=>{if(nama.includes(kata))score++;});
    if(score>bestScore){bestScore=score;bestMatch=state.menuDB[nama];}
  }
  return bestScore>0?bestMatch:null;
}

function parseOrder(transcript){
  const teks=transcript.toLowerCase().trim();
  console.log("📝 Transcript:",teks);

  let noMeja=state.orderMeja;
  const mejaMatch=teks.match(/meja\s+(\w+)/i);
  if(mejaMatch){
    const mejaNum=parseAngka(mejaMatch[1]);
    if(mejaNum)noMeja="M"+String(mejaNum).padStart(2,"0");
  }

  let teksMenu=teks.replace(/meja\s+\w+/i,"").trim();
  teksMenu=teksMenu.replace(/\s+(sama|terus|lalu|plus|dan)\s+/gi," ");

  const itemsBaru=parseItemsSmart(teksMenu);

  state.orderMeja=noMeja;
  state.selectedMeja=noMeja;

  itemsBaru.forEach(newItem=>{
    const existing=state.orderItems.findIndex(i=>i.id===newItem.id&&!i.error&&!newItem.error);
    if(existing>=0){
      state.orderItems[existing].qty+=newItem.qty;
      state.orderItems[existing].subtotal=state.orderItems[existing].qty*state.orderItems[existing].harga;
    }else{
      state.orderItems.push(newItem);
    }
  });

  tampilkanHasil();
}

function parseItemsSmart(teksMenu){
  const hasil=[];
  let sisa=teksMenu.replace(/[,.]/g," ").replace(/\s+/g," ").trim();

  const isAngka=(kata)=>{
    if(!kata)return false;
    if(angkaMap[kata]!==undefined)return true;
    return /^\d+$/.test(kata);
  };

  function cariSatuItem(str){
    const kata=str.split(/\s+/).filter(k=>k);
    if(kata.length===0)return null;

    for(let i=0;i<kata.length;i++){
      for(let len=Math.min(5,kata.length-i);len>=1;len--){
        const kandidat=kata.slice(i,i+len).join(" ");
        const sisaKata=kata.slice(i+len);
        const menu=cariMenu(kandidat);
        if(menu){
          if(sisaKata.length>0&&isAngka(sisaKata[0])){
            const qty=parseAngka(sisaKata[0])||1;
            return{item:{id:menu.id,nama:menu.nama,qty:qty,harga:menu.harga,subtotal:qty*menu.harga},
              before:kata.slice(0,i).join(" "),after:sisaKata.slice(1).join(" ")};
          }
        }
      }
    }

    if(isAngka(kata[0])){
      const qty=parseAngka(kata[0])||1;
      for(let len=Math.min(5,kata.length-1);len>=1;len--){
        const kandidat=kata.slice(1,1+len).join(" ");
        const menu=cariMenu(kandidat);
        if(menu){
          return{item:{id:menu.id,nama:menu.nama,qty:qty,harga:menu.harga,subtotal:qty*menu.harga},
            before:"",after:kata.slice(1+len).join(" ")};
        }
      }
    }

    for(let i=0;i<kata.length;i++){
      for(let len=Math.min(5,kata.length-i);len>=1;len--){
        const kandidat=kata.slice(i,i+len).join(" ");
        const menu=cariMenu(kandidat);
        if(menu){
          return{item:{id:menu.id,nama:menu.nama,qty:1,harga:menu.harga,subtotal:menu.harga},
            before:kata.slice(0,i).join(" "),after:kata.slice(i+len).join(" ")};
        }
      }
    }
    return null;
  }

  let loopCount=0;
  while(sisa.trim()&&loopCount<30){
    loopCount++;
    const found=cariSatuItem(sisa);
    if(found){
      const leftover=(found.before+" "+found.after).replace(/\s+/g," ").trim();
      hasil.push(found.item);
      sisa=leftover;
    }else{
      const sisaTrim=sisa.trim();
      if(sisaTrim&&!/^\d+$/.test(sisaTrim)){
        hasil.push({id:null,nama:sisaTrim+" (?)",qty:1,harga:0,subtotal:0,error:true});
      }
      break;
    }
  }

  return hasil;
}

// ============================================
// TAMPILKAN HASIL
// ============================================
function tampilkanHasil(){
  const items=state.orderItems;
  const noMeja=state.orderMeja;

  updateVoiceHeader();

  let html="";

  if(noMeja){
    html+='<div style="background:#e3f2fd;padding:12px;border-radius:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;border:1px solid #bbdefb">'+
      '<strong style="color:#0d47a1">🪑 Meja: '+noMeja+'</strong>'+
      '<button onclick="setTakeaway()" style="background:none;border:1px solid #1a73e8;color:#1a73e8;padding:4px 10px;border-radius:8px;font-size:11px;cursor:pointer">Ubah ke Takeaway</button></div>';
  }else{
    html+='<div style="background:#fff3e0;padding:12px;border-radius:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;border:1px solid #ffe0b2">'+
      '<strong style="color:#e65100">🛍️ Takeaway (Bungkus)</strong>'+
      '<button onclick="setDineIn()" style="background:none;border:1px solid #e65100;color:#e65100;padding:4px 10px;border-radius:8px;font-size:11px;cursor:pointer">Pilih Meja</button></div>';
  }

  if(items.length===0){
    html+='<div style="text-align:center;padding:30px;color:#999;font-size:14px">'+
      'Belum ada item. Tekan 🎤 untuk bicara.</div>';
    document.getElementById("hasilPesanan").innerHTML=html;
    return;
  }

  let total=0;
  items.forEach((item,index)=>{
    if(item.error){
      html+='<div class="order-item error">'+
        '<div class="info"><strong>❌ '+item.nama+'</strong><small>Tidak dikenali</small></div>'+
        '<button class="btn-hapus" onclick="hapusItem('+index+')">🗑️</button></div>';
    }else{
      total+=item.subtotal;
      html+='<div class="order-item">'+
        '<div class="info"><strong>'+item.nama+'</strong><small>'+rp(item.harga)+' × '+item.qty+'</small></div>'+
        '<button class="btn-kurang-qty" onclick="kurangQty('+index+')">−</button>'+
        '<div class="qty-badge">'+item.qty+'x</div>'+
        '<button class="btn-tambah-qty" onclick="tambahQty('+index+')">+</button>'+
        '<button class="btn-hapus" onclick="hapusItem('+index+')">🗑️</button></div>';
    }
  });

  html+='<div class="total-box">Total: '+rp(total)+'</div>';
  html+='<div class="order-actions">'+
    '<button class="btn-add-item" onclick="tambahItemVoice()">🎤 Tambah Item</button>'+
    '</div>';
  html+='<button class="btn-primary" style="margin-top:8px" onclick="konfirmasiOrder()">✅ Konfirmasi & Kirim ke Dapur</button>';

  document.getElementById("hasilPesanan").innerHTML=html;
}

// ============================================
// EDIT ITEM
// ============================================
function hapusItem(index){
  const item=state.orderItems[index];
  if(!item)return;
  if(!confirm("Hapus "+item.nama+" dari pesanan?"))return;
  state.orderItems.splice(index,1);
  tampilkanHasil();
  toast("Item dihapus","success");
}

function tambahQty(index){
  const item=state.orderItems[index];
  if(!item)return;
  item.qty++;
  item.subtotal=item.qty*item.harga;
  tampilkanHasil();
}

function kurangQty(index){
  const item=state.orderItems[index];
  if(!item)return;
  if(item.qty<=1){
    if(confirm("Qty "+item.nama+" jadi 0. Hapus item?")){
      state.orderItems.splice(index,1);
      tampilkanHasil();
      toast("Item dihapus","success");
    }
    return;
  }
  item.qty--;
  item.subtotal=item.qty*item.harga;
  tampilkanHasil();
}

function tambahItemVoice(){
  toast("🎤 Siap! Sebutkan item tambahan...");
  window.scrollTo({top:0,behavior:"smooth"});
  setTimeout(()=>{
    if(!isListening)toggleVoice();
  },500);
}

// ============================================
// UBAH MODE
// ============================================
function setTakeaway(){
  state.orderMeja=null;
  state.selectedMeja=null;
  tampilkanHasil();
  toast("Mode: Takeaway 🛍️");
}

function setDineIn(){
  const noMeja=prompt("Masukkan nomor meja (contoh: 5):");
  if(!noMeja)return;
  const num=parseAngka(noMeja)||parseInt(noMeja);
  if(!num){toast("Nomor meja tidak valid","error");return;}
  state.orderMeja="M"+String(num).padStart(2,"0");
  state.selectedMeja=state.orderMeja;
  tampilkanHasil();
  toast("Meja "+state.orderMeja+" dipilih","success");
}

// ============================================
// KONFIRMASI & KIRIM
// ============================================
async function konfirmasiOrder(){
  if(state.orderItems.length===0){toast("Tidak ada item","error");return;}
  await kirimPesanan(state.orderMeja,state.orderItems);
}

async function kirimPesanan(noMeja,items){
  const validItems=items.filter(i=>!i.error).map(i=>({idMenu:i.id,jumlah:i.qty,catatan:""}));
  if(validItems.length===0){toast("Tidak ada menu valid","error");return;}

  const targetMeja=noMeja||"TAKEAWAY";
  const btn=event.target;
  btn.textContent="⏳ Mengirim...";
  btn.disabled=true;

  const result=await apiCall("buatPesanan",{
    noMeja:targetMeja,
    namaPelayan:state.user.nama,
    items:validItems
  });

  if(result.success){
    toast("✅ Pesanan terkirim! "+rp(result.total),"success");
    state.orderItems=[];
    state.orderMeja=null;
    state.selectedMeja=null;
    document.getElementById("hasilPesanan").innerHTML="";
    document.getElementById("transcript").textContent="Hasil suara akan muncul di sini...";

    setTimeout(()=>{
      const info=targetMeja==="TAKEAWAY"?"🛍️ Takeaway":"🪑 Meja "+targetMeja;
      showModal("Pesanan Berhasil",
        'Pesanan <strong>'+info+'</strong> telah terkirim ke dapur.<br>Total: <strong>'+rp(result.total)+'</strong>',
        '<button class="btn-secondary" onclick="closeModal();goTo(\'home\')">Selesai</button>'+
        '<button class="btn-primary" style="flex:1" onclick="closeModal();bayarPesanan(\''+result.idPesanan+'\','+result.total+')">Bayar Sekarang</button>');
    },500);
  }else{
    toast("❌ Gagal: "+result.message,"error");
    btn.textContent="✅ Konfirmasi & Kirim ke Dapur";
    btn.disabled=false;
  }
}

// ============================================
// PEMBAYARAN
// ============================================
async function bayarPesanan(idPesanan,total){
  closeModal();
  showModal("💰 Metode Pembayaran",
    '<p style="text-align:center;font-size:20px;color:#1a73e8;font-weight:700;margin-bottom:16px">'+rp(total)+'</p><p>Pilih metode pembayaran:</p>',
    '<button class="btn-secondary" onclick="prosesBayar(\''+idPesanan+'\',\'Tunai\','+total+')">💵 Tunai</button>'+
    '<button class="btn-secondary" onclick="prosesBayar(\''+idPesanan+'\',\'QRIS\','+total+')">📱 QRIS</button>'+
    '<button class="btn-secondary" onclick="prosesBayar(\''+idPesanan+'\',\'Debit\','+total+')">💳 Debit</button>');
}

async function prosesBayar(idPesanan,metode,total){
  closeModal();
  toast("Memproses pembayaran...");
  const result=await apiCall("pembayaran",{idPesanan,metodeBayar:metode});
  if(result.success){
    const strukResult=await apiCall("struk",{idPesanan});
    showModal("✅ Pembayaran Berhasil",
      '<p style="text-align:center;color:#2e7d32;font-size:16px;font-weight:700">'+metode+' - '+rp(total)+'</p>'+
      '<p style="text-align:center;color:#888;font-size:13px;margin-top:8px">Struk sedang disiapkan...</p>',
      '<button class="btn-secondary" onclick="closeModal();goTo(\'home\')">Selesai</button>'+
      '<button class="btn-cetak" style="flex:1;margin-top:0" onclick="tampilkanStruk(\''+idPesanan+'\')">🖨️ Cetak Struk</button>');

    window._lastStruk = strukResult.struk || "";

    if(state.currentPage==="meja")loadMeja();
if(state.currentPage==="home")loadLaporanDashboard();
  }else{
    toast("❌ "+result.message,"error");
  }
}

// ============================================
// CETAK STRUK
// ============================================
async function tampilkanStruk(idPesanan){
  closeModal();
  const result = await apiCall("struk", {idPesanan});
  if(!result.success || !result.struk){
    toast("❌ Struk tidak tersedia", "error");
    return;
  }
  const strukFormatted = formatStrukFinal(result.struk);
  document.getElementById("strukContent").innerHTML = strukFormatted;
  document.getElementById("strukPreview").classList.add("show");
  window._currentStrukText = result.struk;
}

function formatStrukFinal(strukText){
  return strukText.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function closeStruk(){
  document.getElementById("strukPreview").classList.remove("show");
}

function printStruk(){
  const strukText = window._currentStrukText || "";
  if(!strukText){
    toast("❌ Tidak ada struk untuk dicetak", "error");
    return;
  }
  showModal("🖨️ Pilih Metode Cetak",
    '<p>Pilih cara cetak struk:</p>'+
    '<div style="background:#f8f9fa;padding:12px;border-radius:10px;margin:12px 0;font-size:12px;color:#666">'+
    '<strong>A. Printer Thermal (RawBT)</strong><br>'+
    'Butuh app RawBT + printer Bluetooth<br><br>'+
    '<strong>B. Print Browser</strong><br>'+
    'Print ke printer biasa atau PDF<br>Bisa di-screenshot juga'+
    '</div>',
    '<button class="btn-secondary" onclick="closeModal();printViaBrowser()">🌐 Browser</button>'+
    '<button class="btn-primary" style="flex:1" onclick="closeModal();printViaRawBT()">🖨️ Thermal</button>'
  );
}

function printViaBrowser(){
  const strukText = window._currentStrukText || "";
  const printWindow = window.open("", "_blank", "width=400,height=600");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Struk Siang Malam</title>
      <style>
        @media print {
          @page { margin: 5mm; size: 80mm auto; }
          body { margin: 0; }
        }
        body { 
          font-family: 'Courier New', monospace; 
          font-size: 12px; 
          white-space: pre-wrap; 
          padding: 10px;
          line-height: 1.4;
        }
      </style>
    </head>
    <body>${strukText.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(()=>{
    printWindow.focus();
    printWindow.print();
  }, 500);
}

function printViaRawBT(){
  const strukText = window._currentStrukText || "";
  if(!strukText){
    toast("❌ Tidak ada struk", "error");
    return;
  }
  const encoded = encodeURIComponent(strukText);
  const rawbtUrl = "rawbt:" + encoded;
  toast("Membuka RawBT...", "");
  window.location.href = rawbtUrl;
  setTimeout(()=>{
    showModal("🖨️ RawBT Tidak Terdeteksi",
      '<p>App <strong>RawBT</strong> tidak terinstall di HP Anda.</p>'+
      '<p style="font-size:13px;color:#666">RawBT adalah app gratis untuk print ke printer thermal Bluetooth.</p>'+
      '<div style="background:#e3f2fd;padding:10px;border-radius:8px;margin:12px 0;font-size:12px">'+
      '<strong>Cara Install RawBT:</strong><br>'+
      '1. Buka Play Store<br>'+
      '2. Cari "RawBT"<br>'+
      '3. Install (gratis)<br>'+
      '4. Hubungkan printer Bluetooth<br>'+
      '5. Coba cetak lagi'+
      '</div>',
      '<button class="btn-secondary" onclick="closeModal()">Nanti</button>'+
      '<button class="btn-primary" style="flex:1" onclick="closeModal();printViaBrowser()">🌐 Browser</button>'
    );
  }, 2000);
}

// ============================================
// LAPORAN
// ============================================
function setFilter(type, btn){
  document.querySelectorAll(".filter-tab").forEach(t=>t.classList.remove("active"));
  if(btn) btn.classList.add("active");
  currentFilter = type;

  const customRange = document.getElementById("customRange");
  if(type === "custom"){
    customRange.style.display = "block";
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("inputTglMulai").value = today;
    document.getElementById("inputTglAkhir").value = today;
    return;
  } else {
    customRange.style.display = "none";
  }

  const range = hitungRangeTanggal(type);
  currentRange = range;
  loadLaporan(range.mulai, range.akhir);
}

function hitungRangeTanggal(type){
  const today = new Date();
  const format = (d) => d.toISOString().split("T")[0];

  if(type === "today"){
    return { mulai: format(today), akhir: format(today) };
  }
  if(type === "yesterday"){
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { mulai: format(y), akhir: format(y) };
  }
  if(type === "7days"){
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { mulai: format(d), akhir: format(today) };
  }
  if(type === "30days"){
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return { mulai: format(d), akhir: format(today) };
  }
  return { mulai: format(today), akhir: format(today) };
}

function loadCustomRange(){
  const mulai = document.getElementById("inputTglMulai").value;
  const akhir = document.getElementById("inputTglAkhir").value;
  if(!mulai || !akhir){
    toast("Pilih tanggal mulai & akhir", "error");
    return;
  }
  if(mulai > akhir){
    toast("Tanggal mulai harus sebelum tanggal akhir", "error");
    return;
  }
  currentRange = { mulai, akhir };
  loadLaporan(mulai, akhir);
}

async function loadLaporan(mulai, akhir){
  const content = document.getElementById("laporanContent");
  content.innerHTML = '<div class="loading"><div class="spinner"></div><br>Memuat laporan...</div>';

  const [laporan, menuTop, perJam] = await Promise.all([
    apiCall("laporanPeriode", { tanggalMulai: mulai, tanggalAkhir: akhir }),
    apiCall("menuTerlaris", { tanggalMulai: mulai, tanggalAkhir: akhir }),
    apiCall("penjualanPerJam", { tanggal: akhir })
  ]);

  if(!laporan.success){
    content.innerHTML = '<div class="card"><p>❌ ' + (laporan.message || "Gagal memuat") + '</p></div>';
    return;
  }

  let html = "";

  const labelPeriode = mulai === akhir 
    ? formatTanggalIndo(mulai)
    : formatTanggalIndo(mulai) + " - " + formatTanggalIndo(akhir);

  // Ringkasan
  html += '<div class="card">';
  html += '<h2>💰 Ringkasan <span style="font-size:11px;color:#888">' + labelPeriode + '</span></h2>';
  html += '<div class="amount">' + rp(laporan.totalPenjualan) + '</div>';
  html += '<div class="row-info"><span>Jumlah Transaksi</span><strong>' + laporan.jumlahTransaksi + ' pesanan</strong></div>';
  html += '<div class="row-info"><span>Rata-rata/Transaksi</span><strong>' + rp(laporan.rataRata) + '</strong></div>';
  html += '</div>';

  // Metode bayar
  html += '<div class="card">';
  html += '<h2>💳 Metode Pembayaran</h2>';
  const total = laporan.totalPenjualan || 1;
  const pctTunai = ((laporan.breakdown.tunai / total) * 100).toFixed(1);
  const pctQRIS = ((laporan.breakdown.qris / total) * 100).toFixed(1);
  const pctDebit = ((laporan.breakdown.debit / total) * 100).toFixed(1);
  html += '<div class="row-info"><span>💵 Tunai (' + pctTunai + '%)</span><strong>' + rp(laporan.breakdown.tunai) + '</strong></div>';
  html += '<div class="row-info"><span>📱 QRIS (' + pctQRIS + '%)</span><strong>' + rp(laporan.breakdown.qris) + '</strong></div>';
  html += '<div class="row-info"><span>💳 Debit (' + pctDebit + '%)</span><strong>' + rp(laporan.breakdown.debit) + '</strong></div>';
  html += '</div>';

  // Menu terlaris
  if(menuTop.success && menuTop.data.length > 0){
    html += '<div class="card">';
    html += '<h2>🏆 Top Menu Terlaris</h2>';
    menuTop.data.forEach((m, i) => {
      const rankClass = i === 0 ? "top1" : (i === 1 ? "top2" : (i === 2 ? "top3" : ""));
      html += '<div class="menu-rank">';
      html += '<div class="rank ' + rankClass + '">' + (i + 1) + '</div>';
      html += '<div class="info"><strong>' + m.nama + '</strong><small>' + m.qty + ' porsi terjual</small></div>';
      html += '<div class="total">' + rp(m.total) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Penjualan per jam
  if(mulai === akhir && perJam.success){
    const jamRamai = perJam.data.filter(j => j.total > 0);
    if(jamRamai.length > 0){
      const maxTotal = Math.max(...jamRamai.map(j => j.total));
      html += '<div class="card">';
      html += '<h2>⏰ Penjualan per Jam</h2>';
      html += '<div class="chart-bar">';
      jamRamai.forEach(j => {
        const tinggi = (j.total / maxTotal) * 100;
        html += '<div class="chart-col">';
        html += '<div class="bar" style="height:' + tinggi + '%" title="' + j.jam + ':00 - ' + rp(j.total) + '"></div>';
        html += '<div class="label">' + j.jam + '</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<p style="text-align:center;font-size:12px;color:#888;margin-top:8px">Jam: ' + jamRamai[0].jam + ':00 - ' + jamRamai[jamRamai.length-1].jam + ':00</p>';
      html += '</div>';
    }
  }

  content.innerHTML = html;
  window._laporanData = { laporan, menuTop, perJam };
}

function formatTanggalIndo(tglStr){
  const d = new Date(tglStr);
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  return d.getDate() + " " + bulan[d.getMonth()] + " " + d.getFullYear();
}

function exportCSV(){
  if(!window._laporanData){
    toast("Data belum siap", "error");
    return;
  }

  const { laporan, menuTop } = window._laporanData;
  let csv = "";

  csv += "LAPORAN PENJUALAN - SIANG MALAM\n";
  csv += "Periode: " + laporan.tanggalMulai + " s/d " + laporan.tanggalAkhir + "\n\n";

  csv += "RINGKASAN\n";
  csv += "Total Penjualan," + laporan.totalPenjualan + "\n";
  csv += "Jumlah Transaksi," + laporan.jumlahTransaksi + "\n";
  csv += "Rata-rata/Transaksi," + laporan.rataRata + "\n\n";

  csv += "METODE PEMBAYARAN\n";
  csv += "Tunai," + laporan.breakdown.tunai + "\n";
  csv += "QRIS," + laporan.breakdown.qris + "\n";
  csv += "Debit," + laporan.breakdown.debit + "\n\n";

  if(menuTop.success && menuTop.data.length > 0){
    csv += "MENU TERLARIS\n";
    csv += "Rank,Nama Menu,Qty Terjual,Total Penjualan\n";
    menuTop.data.forEach((m, i) => {
      csv += (i+1) + ',"' + m.nama + '",' + m.qty + "," + m.total + "\n";
    });
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "laporan-siang-malam-" + laporan.tanggalMulai + ".csv";
  a.click();
  URL.revokeObjectURL(url);

  toast("✅ Laporan di-download", "success");
}

// ============================================
// INIT
// ============================================
document.addEventListener("keypress",(e)=>{
  if(e.key==="Enter"&&state.currentPage==="login")doLogin();
});

window.addEventListener("DOMContentLoaded",()=>{
  const savedUser=loadSession();
  if(savedUser){
    state.user=savedUser;
    applyLoginUI();
  }
});

console.log("🍛 POS Siang Malam loaded (v4 - modular)!");
