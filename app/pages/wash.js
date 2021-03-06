'use strict'

const KoaRouter = require('koa-router');
const Consolidate = require('consolidate');

const FREE_WASHING_COUNT = 10;

const router = new KoaRouter();

router.get('/wash', RegistrationNumberForm);
router.post('/wash', OnSelectWashProgram);

async function RegistrationNumberForm(ctx) {

    if ("reg_number" in ctx.request.query) {

        var regNumber = ctx.request.query.reg_number.toUpperCase();
        var CarModel = require('app/models/car');
    
        var carId = await CarModel.GetByRegNumberOrCreate(regNumber);
        console.log(`Car of reg_number ${regNumber} id=${carId}`);
    
        var WashTypeModel = require('app/models/wash_type');
        
        var washTypes = await WashTypeModel.GetWashTypes();
        var carData = await CarModel.GetCarDataById(carId);
    
        var thisWashCount = carData.notUsedWashingCount + 1;
        
        var locals = {
            "reg_number": carData.reg_number,
            "wash_types" : washTypes,
            "id": ctx.params.id,
            "washingCountText": WashCountToText(thisWashCount, carData.reg_number),
            "isFreeWash": (thisWashCount >= FREE_WASHING_COUNT)
        };
    
        ctx.viewModel.content = await Consolidate.mustache('app/views/SelectWashingProgram.mustache', locals);
    }
    else {
        ctx.viewModel.content = await Consolidate.mustache('app/views/RegistrationNumberForm.mustache', {});
    }
}

function WashCountToText(washCount, regNumber) {

    var countText;
    var countRemainder = washCount;

    countRemainder = washCount % 100;
    if (countRemainder > 20) {
        countRemainder = countRemainder % 10;
    }

    if (countRemainder == 1) {
        countText = `sze`;
    }
    else if (countRemainder == 2) {
        countText = `gie`;
    }
    else if (countRemainder == 3) {
        countText =`cie`;
    }
    else {
        countText = `te`
    }
    return `${washCount}${countText} mycie pojazdu ${regNumber}`;
}
    
async function OnSelectWashProgram(ctx) {

    if (ctx.request.body.submit_cancel_wash != undefined) {
        ctx.redirect('/wash');
        return;
    }
    var carRegNumber = ctx.request.body.reg_number;
    var washTypeId = ctx.request.body.wash_type;

    var CarModel = require('app/models/car');

    var CarObject = await CarModel.GetByRegNumber(carRegNumber);

    console.log(`SelectWashProgram ${carRegNumber} WashType ${washTypeId}`);

    // Save washing in history
    var WashHistoryModel = require('app/models/wash_history');

    var historyEntryId = await WashHistoryModel.AddHistory(CarObject.id, washTypeId, null, ctx.session.user.id);
    if (historyEntryId < 0) {
        // TODO - error (throw something)
        var locals = {
            "error": "Błąd rejestracji mycia samochodu",
            "main_url": "/wash"
        }
        // Save failure
        ctx.viewModel.content = await Consolidate.mustache('app/views/WashingError.mustache', locals);
    }
    else {
        if ( ctx.request.body.free_wash != undefined ) {
            var notUsedWashings = await WashHistoryModel.GetNotUsedWashings(CarObject.id);
            var notUsedIds = notUsedWashings.map(a => a.id);
            await WashHistoryModel.SetUsedWithIdToEntries(historyEntryId, notUsedIds);
        }
        
        var WashTypeModel = require('app/models/wash_type');
        var washType = await WashTypeModel.GetWashTypeById(washTypeId)
        var locals = {
            "reg_number" : carRegNumber,
            "wash_type_text": washType.name,
            "main_url": "/wash"
        };
        // And show Confirmation window
        ctx.viewModel.content = await Consolidate.mustache('app/views/ConfirmWashing.mustache', locals);
    }
}

module.exports = router.routes();