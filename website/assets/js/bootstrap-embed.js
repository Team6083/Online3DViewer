OV.SetWebsiteEventHandler ((eventName, eventLabel, eventParams) => {
    console.log ({
        eventName : eventName,
        eventLabel : eventLabel,
        eventParams : eventParams
    });
});

OV.StartEmbed ();
