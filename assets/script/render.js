const $ = require("jquery");    
const { ipcRenderer, ipcMain } = require("electron");
function load_new_page(page){
    $("#loader").fadeIn(300);
    ipcRenderer.send('load_page' , page);
    setTimeout(() => {
        if(page != 'main'){
            $("#back-to-main").css('display' , 'block ')
            $("#header .inner").css('justify-content' , 'space-between ')
    
        }else{
            $("#back-to-main").css('display' , 'none ')
            $("#header .inner").css('justify-content' , 'center ')
        }
    }, 300);
}
ipcRenderer.on('new_page_content' , (event , content , page ) => {
    $("#content").html(content);
    $("#loader").fadeOut(1000);
    main_scripts(page);
}) 

    ipcRenderer.on('Alarms' , (event , data) => {
        if(data.length == 0 ) {
            $("#alarm-list").html('Alarm list is empty')
        }
        data.forEach((element , index) => {
            $("#alarm-list").append(`
                <div id="alarm-index-${index}" class="alarm-option">
                    <div class='time' >
                        ${element.name +  ' - ' +element.time.join(":")}
                    </div>
                    <div class='flex-gap' >
                        <button class='delete-alarm' data-alarm="${index}" class='delete-alarm' > 
                            Delete
                        </button>
                        <label class="switch">
                            <input class='alarm-active' id='change-activate-${index}' type="checkbox"  ${element.active ? 'checked' : ''} > 
                            <span class="slider"></span>
                        </label>   
                       
                    </div>
                </div>
            `)
        });
        $(".alarm-active").change(function() {
            ipcRenderer.send('changeAlarmStatus' , $(this).prop('checked') , $(this).attr('id').replace('change-activate-' , ''));
        })
        $(".delete-alarm").click(function() {
            ipcRenderer.send('DeleteAlarm' , $(this).data('alarm'))
        })


    })
ipcRenderer.on('AlarmDeleted' , (event , index) => {
    $("#alarm-list").html("")
    ipcRenderer.send("GetAlarms" )

})
function main_scripts(page){
    $("#loader").fadeOut(1000)
    $("#send-hibernate").click(() => {
        ipcRenderer.send("hibernate");
    });

    $("#shutdown").click(() => {
        ipcRenderer.send("shutdown");
    });
    $(".page-btn").click(function() {
        load_new_page($(this).data('page'))
    });
    $("#download-spdlink").click(() => {
        ipcRenderer.send('spd' , $("#spd-input").val())
    })

    if(page == 'alarms') {
        ipcRenderer.send("GetAlarms" )
        

    }
    if(page == "new_alarm" ) {
        $("#save_alarm").click(() => {
            const timeValue = $("#alarm_time").val();
            const [hour, minute] = timeValue.split(":");

            ipcRenderer.send("AddAlarm" , $("#alarm_name").val() , hour , minute)
            load_new_page('alarms')

        })
        flatpickr("#alarm_time", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true
          });
    }
    if(page == "settings") {
        ipcRenderer.send('GetConfigs');
        ipcRenderer.on('Configs' , (event , data) => {
            $("#auto-hibernate").attr('checked' , data.autoHibernate)
        })
        $("#auto-hibernate").click(function() {
            ipcRenderer.send('ChangeConfigs' , 'autoHibernate' , $(this).prop('checked'))
        })
    }

}
ipcRenderer.on("spd-done" , (event , link ) => {
    $("#spd-out").val(link)
})