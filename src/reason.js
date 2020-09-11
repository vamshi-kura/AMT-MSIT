const electron = require('electron')
const ipc = electron.ipcRenderer
let reason_data
document.getElementById('submit').addEventListener('click', () => {
	reason_data = document.getElementById('textarea-form').value
	if (reason_data.length != 0){
		document.getElementById('textarea-form').value = ''
		ipc.send('startCapture', `closeReasonWindow-${reason_data}`)
	}else{
		alert('Please submit the reason in the text box')
	}// ipc.send('')
})