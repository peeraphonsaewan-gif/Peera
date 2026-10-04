(function(){
 var STAFF_USERNAME = 'admin';
 var STAFF_PASSWORD = 'adminup';
 var CURRENT_USER = null;
 var CURRENT_ROLE = null;
 var CURRENT_MEMBER = null;
 var LOCK_TIMEOUT_MS = 10000;
 var LOCK_USER_ID = 'user_' + Math.random().toString(36).substr(2, 9);
 var lastSuccessBooking = null;
 var successCancelConfirming = false;
 var successCancelTimer = null;
 var SLOTS = [
   { id: 's1', label: '10:00 - 11:30', endHour: 11, endMinute: 30 },
   { id: 's2', label: '11:30 - 13:00', endHour: 13, endMinute: 0 },
   { id: 's3', label: '13:00 - 14:30', endHour: 14, endMinute: 30 },
   { id: 's4', label: '14:30 - 16:00', endHour: 16, endMinute: 0 },
   { id: 's5', label: '16:00 - 17:30', endHour: 17, endMinute: 30 },
   { id: 's6', label: '17:30 - 19:00', endHour: 19, endMinute: 0 },
   { id: 's7', label: '19:00 - 21:00', endHour: 21, endMinute: 0 }
 ];
 var THAI_DOW = ['อา','จ','อ','พ','พฤ','ศ','ส'];
 var THAI_MONTH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
 function dateKey(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
 function formatThaiDate(dateStr) {
   var parts = dateStr.split('-');
   var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
   return d.getDate() + ' ' + THAI_MONTH[d.getMonth()] + ' ' + THAI_DOW[d.getDay()];
 }
 function isDateExpired(dateStr) {
   var today = new Date(); today.setHours(0,0,0,0);
   var target = new Date(dateStr); target.setHours(0,0,0,0);
   return target < today;
 }
 function isSlotExpired(dateStr, slot) {
   if (dateStr !== dateKey(new Date())) return false;
   var now = new Date();
   var endTime = new Date(); endTime.setHours(slot.endHour, slot.endMinute, 0, 0);
   return now >= endTime;
 }
 function normalizeId(id) {
   if (!id) return '';
   return String(id).replace('@up.ac.th', '').trim();
 }
 function showBookingMsg(text, type) {
   var box = document.getElementById('booking-msg');
   box.innerHTML = '<div class="msg ' + type + '">' + text + '</div>';
   setTimeout(function(){ box.innerHTML = ''; }, 4000);
 }
 var dates = [];
 for (var i = 0; i < 7; i++) { var d = new Date(); d.setDate(d.getDate() + i); dates.push(d); }
 var selectedDate = dateKey(dates[0]);
 var selectedSlot = null;
 var memoryStore = {};
 var storageAvailable = true;
 try { localStorage.setItem('__t__','1'); localStorage.removeItem('__t__'); } catch(e) { storageAvailable = false; }
 function safeSet(k,v){ if(storageAvailable){try{localStorage.setItem(k,v);return true;}catch(e){storageAvailable=false;}} memoryStore[k]=v; return true; }
 function safeGet(k){ if(storageAvailable){try{var v=localStorage.getItem(k);if(v!==null)return v;}catch(e){}} return memoryStore.hasOwnProperty(k)?memoryStore[k]:null; }
 function safeList(prefix){ var keys=[]; if(storageAvailable){try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf(prefix)===0)keys.push(k);}}catch(e){}} Object.keys(memoryStore).forEach(function(k){if(k.indexOf(prefix)===0&&keys.indexOf(k)===-1)keys.push(k);}); return keys; }
 function safeRemove(k){ if(storageAvailable){try{localStorage.removeItem(k);return true;}catch(e){storageAvailable=false;}} if(memoryStore.hasOwnProperty(k)){delete memoryStore[k];return true;} return false; }
 function getLockKey(d,s){ return 'lock:booking:'+d+':'+s; }
 function acquireLock(d,s){
   var k=getLockKey(d,s), now=Date.now(), ex=safeGet(k);
   if(ex){ try{ var ld=JSON.parse(ex); if(now-ld.lockedAt<LOCK_TIMEOUT_MS)return false; }catch(e){} }
   safeSet(k, JSON.stringify({lockedBy:LOCK_USER_ID, lockedAt:now}));
   return true;
 }
 function releaseLock(d,s){
   var k=getLockKey(d,s), ex=safeGet(k);
   if(ex){ try{ var ld=JSON.parse(ex); if(ld.lockedBy===LOCK_USER_ID)safeRemove(k); }catch(e){safeRemove(k);} }
 }
 function isLocked(d,s){
   var k=getLockKey(d,s), ex=safeGet(k);
   if(!ex)return false;
   try{ var ld=JSON.parse(ex), now=Date.now(); if(ld.lockedBy===LOCK_USER_ID)return false; return (now-ld.lockedAt<LOCK_TIMEOUT_MS); }catch(e){return false;}
 }
 function getMember(id){ var r=safeGet('member:'+id); if(r){try{return JSON.parse(r);}catch(e){}} return null; }
 function saveMember(d){ return safeSet('member:'+d.studentId, JSON.stringify(d)); }
 function cancelBooking(bDate, bSlotId) {
   var bookingKey = 'booking:' + bDate + ':' + bSlotId;
   var existing = safeGet(bookingKey);
   if (!existing) return { success: false, message: 'ไม่พบข้อมูลการจองนี้' };
   try {
     var data = JSON.parse(existing);
     var currentStudentId = CURRENT_MEMBER ? CURRENT_MEMBER.studentId : CURRENT_USER.replace('@up.ac.th','');
     if (normalizeId(data.studentId) !== normalizeId(currentStudentId)) {
       return { success: false, message: 'ไม่สามารถยกเลิกการจองของผู้อื่นได้' };
     }
   } catch(e) {}
   var removed = safeRemove(bookingKey);
   if (removed) {
     renderSlots();
     loadMyBookings();
     return { success: true, message: 'ยกเลิกการจองเรียบร้อยแล้ว ช่วงเวลานี้กลับมาว่างอีกครั้ง' };
   }
   return { success: false, message: 'ยกเลิกไม่สำเร็จ กรุณาลองใหม่' };
 }
 var loginForm=document.getElementById('login-form'), registerForm=document.getElementById('register-form'), staffLoginForm=document.getElementById('staff-login-form');
 function showForm(f){ loginForm.classList.add('hidden'); registerForm.classList.add('hidden'); staffLoginForm.classList.add('hidden'); f.classList.remove('hidden'); }
 document.getElementById('go-to-register').addEventListener('click',function(){showForm(registerForm);});
 document.getElementById('go-to-login').addEventListener('click',function(){showForm(loginForm);});
 document.getElementById('switch-to-staff').addEventListener('click',function(){showForm(staffLoginForm);});
 document.getElementById('switch-to-student').addEventListener('click',function(){showForm(loginForm);});
 var loginMsg=document.getElementById('login-msg');
 loginForm.addEventListener('submit',function(e){
   e.preventDefault();
   var id=document.getElementById('student-id').value.trim(), pw=document.getElementById('password').value;
   loginMsg.innerHTML='';
   if(!/^[0-9]{6,10}$/.test(id)){loginMsg.innerHTML='<div class="msg error">กรุณากรอกรหัสนิสิตให้ถูกต้อง (ตัวเลข 6-10 หลัก)</div>';return;}
   if(!pw){loginMsg.innerHTML='<div class="msg error">กรุณากรอกรหัสผ่าน</div>';return;}
   var m=getMember(id);
   if(!m){loginMsg.innerHTML='<div class="msg error">ยังไม่ได้สมัครสมาชิก กรุณาคลิก "สมัครสมาชิก" ก่อน</div>';return;}
   if(m.password!==pw){loginMsg.innerHTML='<div class="msg error">รหัสผ่านไม่ถูกต้อง</div>';return;}
   CURRENT_MEMBER=m; CURRENT_USER=id+'@up.ac.th'; CURRENT_ROLE='student'; enterApp();
 });
 var registerMsg=document.getElementById('register-msg');
 registerForm.addEventListener('submit',function(e){
   e.preventDefault();
   var id=document.getElementById('reg-student-id').value.trim(), name=document.getElementById('reg-fullname').value.trim(),
       fac=document.getElementById('reg-faculty').value.trim(), pw=document.getElementById('reg-password').value,
       cpw=document.getElementById('reg-confirm-password').value;
   registerMsg.innerHTML='';
   if(!/^[0-9]{6,10}$/.test(id)){registerMsg.innerHTML='<div class="msg error">รหัสนิสิตไม่ถูกต้อง</div>';return;}
   if(!name){registerMsg.innerHTML='<div class="msg error">กรุณากรอกชื่อ-นามสกุล</div>';return;}
   if(!pw||pw.length<4){registerMsg.innerHTML='<div class="msg error">รหัสผ่านอย่างน้อย 4 ตัว</div>';return;}
   if(pw!==cpw){registerMsg.innerHTML='<div class="msg error">รหัสผ่านไม่ตรงกัน</div>';return;}
   if(getMember(id)){registerMsg.innerHTML='<div class="msg error">รหัสนิสิตนี้สมัครแล้ว</div>';return;}
   if(saveMember({studentId:id,fullname:name,faculty:fac,password:pw,registeredAt:new Date().toISOString()})){
     registerMsg.innerHTML='<div class="msg success">สมัครสำเร็จ! กำลังไปหน้าเข้าสู่ระบบ...</div>';
     registerForm.reset();
     setTimeout(function(){showForm(loginForm);document.getElementById('student-id').value=id;registerMsg.innerHTML='';},1500);
   }
 });
 var staffLoginMsg=document.getElementById('staff-login-msg');
 staffLoginForm.addEventListener('submit',function(e){
   e.preventDefault();
   var u=document.getElementById('staff-username').value.trim(), p=document.getElementById('staff-password').value;
   staffLoginMsg.innerHTML='';
   if(u!==STAFF_USERNAME||p!==STAFF_PASSWORD){staffLoginMsg.innerHTML='<div class="msg error">ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง</div>';return;}
   CURRENT_USER=u; CURRENT_ROLE='staff'; CURRENT_MEMBER=null; enterApp();
 });
 function enterApp(){
   document.getElementById('login-screen').classList.add('hidden');
   document.getElementById('app-screen').classList.remove('hidden');
   var bv=document.getElementById('booking-view'), av=document.getElementById('admin-view');
   if(CURRENT_ROLE==='staff'){
     document.getElementById('brand-title').innerHTML='ระบบหลังบ้าน<span id="who-label"></span>';
     document.getElementById('who-label').textContent='เจ้าหน้าที่: '+CURRENT_USER;
     bv.classList.add('hidden'); av.classList.remove('hidden'); loadAdmin();
   } else {
     var lbl=CURRENT_USER;
     if(CURRENT_MEMBER&&CURRENT_MEMBER.fullname) lbl=CURRENT_MEMBER.fullname+' ('+CURRENT_USER+')';
     document.getElementById('who-label').textContent=lbl;
     av.classList.add('hidden'); document.getElementById('booking-success-view').classList.add('hidden');
     bv.classList.remove('hidden'); renderDates(); renderSlots(); loadMyBookings();
   }
 }
 document.getElementById('logout-btn').addEventListener('click',function(){
   CURRENT_USER=null;CURRENT_ROLE=null;CURRENT_MEMBER=null;lastSuccessBooking=null;
   document.getElementById('password').value='';document.getElementById('staff-username').value='';document.getElementById('staff-password').value='';
   showForm(loginForm);
   document.getElementById('app-screen').classList.add('hidden');
   document.getElementById('login-screen').classList.remove('hidden');
   document.getElementById('booking-success-view').classList.add('hidden');
   document.getElementById('booking-view').classList.remove('hidden');
   document.getElementById('booking-msg').innerHTML='';
 });
 document.getElementById('admin-refresh').addEventListener('click',loadAdmin);
 window.addEventListener('storage',function(e){
   if(e.key&&(e.key.indexOf('booking:')===0||e.key.indexOf('lock:')===0)){
     if(!document.getElementById('booking-view').classList.contains('hidden')){renderSlots();loadMyBookings();}
     if(!document.getElementById('admin-view').classList.contains('hidden')){loadAdmin();}
   }
 });
 function renderDates(){
   var w=document.getElementById('date-scroll'); w.innerHTML='';
   dates.forEach(function(d){
     var k=dateKey(d), exp=isDateExpired(k);
     var pill=document.createElement('div');
     pill.className='date-pill'+(k===selectedDate?' selected':'')+(exp?' expired':'');
     pill.innerHTML='<div class="dow">'+THAI_DOW[d.getDay()]+'</div><div class="dom">'+d.getDate()+'</div>';
     if(!exp) pill.addEventListener('click',function(){selectedDate=k;selectedSlot=null;renderDates();renderSlots();});
     w.appendChild(pill);
   });
 }
 function getBookedSlotsForDate(date){
   var booked={}, keys=safeList('booking:'+date+':');
   for(var i=0;i<keys.length;i++){var r=safeGet(keys[i]);if(r){try{var d=JSON.parse(r);booked[keys[i].split(':')[2]]=d;}catch(e){}}}
   return booked;
 }
 function renderSlots(){
   var list=document.getElementById('slot-list'), booked=getBookedSlotsForDate(selectedDate);
   list.innerHTML='';
   SLOTS.forEach(function(slot){
     var isB=!!booked[slot.id], lk=!isB&&isLocked(selectedDate,slot.id), exp=!isB&&!lk&&isSlotExpired(selectedDate,slot);
     var row=document.createElement('div'), cls='', txt='';
     if(isB){cls=' booked';txt='จองแล้ว';}else if(exp){cls=' expired';txt='หมดเวลาแล้ว';}else if(lk){cls=' locked';txt='กำลังดำเนินการ...';}else{txt='ว่าง';}
     row.className='slot'+cls+(selectedSlot===slot.id?' selected':'');
     row.innerHTML='<span class="time">'+slot.label+'</span><span class="status">'+txt+'</span>';
     if(!isB&&!exp&&!lk) row.addEventListener('click',function(){selectedSlot=(selectedSlot===slot.id)?null:slot.id;renderSlots();updateSummary();});
     list.appendChild(row);
   });
   updateSummary();
 }
 function updateSummary(){
   var s=document.getElementById('booking-summary'), b=document.getElementById('confirm-btn');
   if(!selectedSlot){s.textContent='เลือกวันและเวลาที่ต้องการจอง';b.disabled=true;return;}
   var so=SLOTS.find(function(x){return x.id===selectedSlot;});
   if(isSlotExpired(selectedDate,so)){s.textContent='ช่วงเวลานี้หมดแล้ว';b.disabled=true;selectedSlot=null;return;}
   var d=dates.find(function(x){return dateKey(x)===selectedDate;});
   s.textContent='วันที่ '+d.getDate()+' '+THAI_MONTH[d.getMonth()]+'  •  '+so.label;
   b.disabled=false;
 }
 document.getElementById('confirm-btn').addEventListener('click',function(){
   if(!selectedSlot||!CURRENT_USER)return;
   var btn=this, msg=document.getElementById('booking-msg'); msg.innerHTML='';
   var so=SLOTS.find(function(s){return s.id===selectedSlot;});
   if(isSlotExpired(selectedDate,so)){showBookingMsg('หมดเวลาแล้ว','error');selectedSlot=null;renderSlots();return;}
   btn.disabled=true;btn.textContent='กำลังตรวจสอบ...';
   var bk='booking:'+selectedDate+':'+selectedSlot;
   try{
     if(!acquireLock(selectedDate,selectedSlot)){
       showBookingMsg('มีผู้อื่นกำลังจองช่วงนี้ กรุณารอหรือเลือกช่วงอื่น','warning');
       selectedSlot=null;renderSlots();btn.textContent='ยืนยันการจอง';updateSummary();return;
     }
     btn.textContent='กำลังบันทึก...';
     if(safeGet(bk)){
       showBookingMsg('ช่วงนี้เพิ่งถูกจองไปแล้ว','error');
       releaseLock(selectedDate,selectedSlot);selectedSlot=null;renderSlots();btn.textContent='ยืนยันการจอง';updateSummary();return;
     }
     var payload={studentId:CURRENT_MEMBER?CURRENT_MEMBER.studentId:CURRENT_USER.replace('@up.ac.th',''),studentEmail:CURRENT_USER,fullname:CURRENT_MEMBER?CURRENT_MEMBER.fullname:'',faculty:CURRENT_MEMBER?CURRENT_MEMBER.faculty:'',bookedAt:new Date().toISOString()};
     safeSet(bk,JSON.stringify(payload));
     releaseLock(selectedDate,selectedSlot);
     showBookingSuccess(selectedDate,selectedSlot);
     selectedSlot=null;
   }catch(e){releaseLock(selectedDate,selectedSlot);showBookingMsg('เกิดข้อผิดพลาด','error');}
   btn.textContent='ยืนยันการจอง';updateSummary();
 });
 function showBookingSuccess(dk, sid){
   lastSuccessBooking = { date: dk, slotId: sid };
   successCancelConfirming = false;
   if (successCancelTimer) { clearTimeout(successCancelTimer); successCancelTimer = null; }
   document.getElementById('success-cancel-btn').textContent = 'ยกเลิกการจองนี้';
   document.getElementById('success-cancel-btn').classList.remove('confirming');
   document.getElementById('success-cancel-hint').classList.add('hidden');
   var d=dates.find(function(x){return dateKey(x)===dk;});
   var sl=SLOTS.find(function(s){return s.id===sid;}).label;
   document.getElementById('success-student').textContent=CURRENT_USER;
   document.getElementById('success-name').textContent=(CURRENT_MEMBER&&CURRENT_MEMBER.fullname)?CURRENT_MEMBER.fullname:'-';
   document.getElementById('success-date').textContent=d.getDate()+' '+THAI_MONTH[d.getMonth()]+' '+(d.getFullYear()+543);
   document.getElementById('success-slot').textContent=sl;
   document.getElementById('booking-view').classList.add('hidden');
   document.getElementById('booking-success-view').classList.remove('hidden');
 }
 document.getElementById('success-back-btn').addEventListener('click',function(){
   lastSuccessBooking = null;
   successCancelConfirming = false;
   if (successCancelTimer) { clearTimeout(successCancelTimer); successCancelTimer = null; }
   document.getElementById('booking-success-view').classList.add('hidden');
   document.getElementById('booking-view').classList.remove('hidden');
   document.getElementById('booking-msg').innerHTML='';
   renderSlots();loadMyBookings();
 });
 document.getElementById('success-cancel-btn').addEventListener('click',function(){
   if(!lastSuccessBooking) return;
   var btn = this;
   if (!successCancelConfirming) {
     successCancelConfirming = true;
     btn.textContent = 'ยืนยันการยกเลิก?';
     btn.classList.add('confirming');
     document.getElementById('success-cancel-hint').classList.remove('hidden');
     successCancelTimer = setTimeout(function(){
       successCancelConfirming = false;
       btn.textContent = 'ยกเลิกการจองนี้';
       btn.classList.remove('confirming');
       document.getElementById('success-cancel-hint').classList.add('hidden');
     }, 3000);
     return;
   }
   if (successCancelTimer) { clearTimeout(successCancelTimer); successCancelTimer = null; }
   var result = cancelBooking(lastSuccessBooking.date, lastSuccessBooking.slotId);
   lastSuccessBooking = null;
   successCancelConfirming = false;
   btn.textContent = 'ยกเลิกการจองนี้';
   btn.classList.remove('confirming');
   document.getElementById('success-cancel-hint').classList.add('hidden');
   document.getElementById('booking-success-view').classList.add('hidden');
   document.getElementById('booking-view').classList.remove('hidden');
   showBookingMsg(result.message, result.success ? 'success' : 'error');
 });
 document.getElementById('my-booking-list').addEventListener('click',function(e){
   var btn = e.target.closest('.cancel-btn');
   if(!btn || btn.disabled) return;
   var bDate = btn.getAttribute('data-date');
   var bSlot = btn.getAttribute('data-slot');
   if (!btn.getAttribute('data-confirming')) {
     btn.setAttribute('data-confirming', '1');
     btn.textContent = 'ยืนยัน?';
     btn.classList.add('confirming');
     setTimeout(function(){
       if (btn && btn.getAttribute('data-confirming')) {
         btn.removeAttribute('data-confirming');
         btn.textContent = 'ยกเลิก';
         btn.classList.remove('confirming');
       }
     }, 3000);
     return;
   }
   btn.removeAttribute('data-confirming');
   btn.textContent = 'ยกเลิก';
   btn.classList.remove('confirming');
   var result = cancelBooking(bDate, bSlot);
   showBookingMsg(result.message, result.success ? 'success' : 'error');
 });
 function loadMyBookings(){
   var w=document.getElementById('my-booking-list'), cb=document.getElementById('my-booking-count');
   var cid=CURRENT_MEMBER?CURRENT_MEMBER.studentId:CURRENT_USER.replace('@up.ac.th','');
   var mine=[], keys=safeList('booking:');
   for(var i=0;i<keys.length;i++){var r=safeGet(keys[i]);if(r){try{var p=keys[i].split(':'),d=JSON.parse(r);if(normalizeId(d.studentId)===normalizeId(cid)){var so=SLOTS.find(function(s){return s.id===p[2];});mine.push({date:p[1],slotId:p[2],slotLabel:so?so.label:p[2],slotObj:so});}}catch(e){}}}
   mine.sort(function(a,b){return (a.date+a.slotId).localeCompare(b.date+b.slotId);});
   cb.textContent=mine.length; w.innerHTML='';
   if(mine.length===0){w.innerHTML='<div class="my-booking-empty">ยังไม่มีการจอง</div>';return;}
   mine.forEach(function(bk){
     var exp=bk.slotObj?isSlotExpired(bk.date,bk.slotObj):false;
     var it=document.createElement('div'); it.className='my-booking-item';
     var btnDisabled = exp ? ' disabled' : '';
     it.innerHTML='<div class="my-booking-info"><div class="mb-date">'+formatThaiDate(bk.date)+'</div><div class="mb-slot">'+bk.slotLabel+(exp?'  •  หมดเวลาแล้ว':'')+'</div></div>'+
       '<button class="btn-small cancel-btn" data-date="'+bk.date+'" data-slot="'+bk.slotId+'"'+btnDisabled+'>ยกเลิก</button>';
     w.appendChild(it);
   });
 }
 function loadAdmin(){
   var tb=document.getElementById('admin-tbody'), en=document.getElementById('admin-empty'), rb=document.getElementById('admin-refresh');
   rb.disabled=true;rb.classList.add('spinning');
   tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-faint);padding:16px;">กำลังโหลด...</td></tr>';
   en.classList.add('hidden');
   var rows=[], keys=safeList('booking:');
   for(var i=0;i<keys.length;i++){var r=safeGet(keys[i]);if(r){try{var p=keys[i].split(':'),d=JSON.parse(r),so=SLOTS.find(function(s){return s.id===p[2];});rows.push({studentEmail:d.studentEmail||(d.studentId+'@up.ac.th'),fullname:d.fullname||'',date:p[1],slotLabel:so?so.label:p[2],bookedAt:d.bookedAt});}catch(e){}}}
   rows.sort(function(a,b){return (a.date+a.slotLabel).localeCompare(b.date+b.slotLabel);});
   tb.innerHTML='';
   if(rows.length===0){en.classList.remove('hidden');}else{
     rows.forEach(function(row){
       var tr=document.createElement('tr'), bs='';
       try{bs=new Date(row.bookedAt).toLocaleString('th-TH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){bs=row.bookedAt;}
       tr.innerHTML='<td>'+row.studentEmail+'</td><td>'+(row.fullname||'-')+'</td><td>'+row.date+'</td><td>'+row.slotLabel+'</td><td>'+bs+'</td>';
       tb.appendChild(tr);
     });
   }
   var tk=dateKey(new Date());
   document.getElementById('stat-total').textContent=rows.length;
   document.getElementById('stat-today').textContent=rows.filter(function(r){return r.date===tk;}).length;
   document.getElementById('stat-upcoming').textContent=rows.filter(function(r){return r.date>=tk;}).length;
   document.getElementById('last-updated').textContent='อัปเดตล่าสุด '+new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
   rb.disabled=false;rb.classList.remove('spinning');
 }
 setInterval(function(){if(!document.getElementById('booking-view').classList.contains('hidden')){renderSlots();loadMyBookings();}},60000);
 setInterval(function(){var ks=safeList('lock:booking:'),n=Date.now();ks.forEach(function(k){var r=safeGet(k);if(r){try{var d=JSON.parse(r);if(n-d.lockedAt>=LOCK_TIMEOUT_MS)safeRemove(k);}catch(e){safeRemove(k);}}});},2000);
})();